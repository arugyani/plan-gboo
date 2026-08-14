"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleDot,
  Clock3,
  ExternalLink,
  GitPullRequest,
  Link2,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { Card, DashboardData, Importance } from "@/lib/types";
import { cn, formatRelativeDate } from "@/lib/utils";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { Textarea } from "./ui/textarea";

interface CardEditorProps {
  card: Card | null;
  data: DashboardData;
  open: boolean;
  onOpenChange(open: boolean): void;
  onChanged(): Promise<void> | void;
}

async function api<T>(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ?? "That change could not be saved.",
    );
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

const importanceOptions: Importance[] = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
];

export function CardEditor({
  card,
  data,
  open,
  onOpenChange,
  onChanged,
}: CardEditorProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [importance, setImportance] = useState<Importance>("none");
  const [when, setWhen] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [newChecklist, setNewChecklist] = useState("");
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!card) return;
    // The sheet remains mounted for focus restoration, so reset its draft when
    // a different saved card becomes active.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(card.title);
    setNotes(card.notes);
    setImportance(card.importance);
    setWhen(card.when ?? "");
    setBlocked(card.blocked);
    setBlockedReason(card.blockedReason ?? "");
    setPersonIds(card.personIds);
    setTagIds(card.tagIds);
    setGithubUrl("");
    setNewChecklist("");
    setNewComment("");
  }, [card]);

  const board = data.boards.find((item) => item.id === card?.boardId);
  const group = data.groups.find((item) => item.id === board?.groupId);
  const people = data.people.filter(
    (person) =>
      !group || person.groupRoles[group.id] || person.systemRole === "admin",
  );
  const availableTags = data.tags.filter((tag) => tag.groupId === group?.id);
  const cardActivity = data.activity.filter(
    (activity) => activity.cardId === card?.id,
  );
  const canEdit = useMemo(() => {
    if (!group) return false;
    if (data.viewer.systemRole === "admin") return true;
    const role = data.viewer.groupRoles[group.id];
    return role === "organizer" || role === "member";
  }, [data.viewer, group]);

  if (!card) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/cards/${card.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          notes,
          importance,
          when: when || null,
          blocked,
          blockedReason: blocked ? blockedReason || null : null,
          personIds,
          tagIds,
          expectedVersion: card.version,
        }),
      });
      await onChanged();
      toast.success("Card saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That card could not be saved.",
      );
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const addGithub = async () => {
    if (!githubUrl.trim()) return;
    try {
      await api(`/api/cards/${card.id}/links`, {
        method: "POST",
        body: JSON.stringify({ url: githubUrl }),
      });
      setGithubUrl("");
      await onChanged();
      toast.success("GitHub issue linked");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That link could not be added.",
      );
    }
  };

  const addChecklist = async () => {
    if (!newChecklist.trim()) return;
    try {
      await api(`/api/cards/${card.id}/checklist`, {
        method: "POST",
        body: JSON.stringify({ text: newChecklist }),
      });
      setNewChecklist("");
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That checklist item could not be added.",
      );
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api(`/api/cards/${card.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment }),
      });
      setNewComment("");
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That note could not be added.",
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="border-b border-border px-6 pb-5 pt-6 sm:px-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span>{card.key}</span>
            <span aria-hidden>·</span>
            <span>{board?.name}</span>
          </div>
          <SheetTitle className="sr-only">{card.title}</SheetTitle>
          <SheetDescription className="sr-only">
            Card details and conversation
          </SheetDescription>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!canEdit}
            aria-label="Card title"
            className="h-auto border-0 bg-transparent px-0 py-0 font-display text-2xl font-semibold leading-tight shadow-none focus-visible:ring-0"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={blocked ? "danger" : "neutral"}>
              <CircleDot className="size-3" />
              {blocked
                ? "Waiting"
                : data.columns.find((item) => item.id === card.columnId)?.name}
            </Badge>
            <Badge variant="neutral">
              <CalendarDays className="size-3" />{" "}
              {formatRelativeDate(card.when)}
            </Badge>
            {card.links.length ? (
              <Badge variant="purple">
                <GitPullRequest className="size-3" /> {card.links.length} linked
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-8 px-6 py-7 sm:px-8">
          {!canEdit ? (
            <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              You have view-only access to this group.
            </div>
          ) : null}

          <section className="space-y-3">
            <label htmlFor="card-notes" className="text-sm font-semibold">
              Notes
            </label>
            <Textarea
              id="card-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!canEdit}
              placeholder="A little context helps everyone…"
              className="min-h-36"
            />
            {notes ? (
              <div className="markdown-preview rounded-xl border border-border bg-background/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                <ReactMarkdown>{notes}</ReactMarkdown>
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor="card-importance"
              className="space-y-2 text-sm font-semibold"
            >
              <span>Importance</span>
              <select
                id="card-importance"
                value={importance}
                onChange={(event) =>
                  setImportance(event.target.value as Importance)
                }
                disabled={!canEdit}
                className="h-10 w-full rounded-lg border border-input bg-background/70 px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
              >
                {importanceOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === "none"
                      ? "No preference"
                      : value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor="card-when"
              className="space-y-2 text-sm font-semibold"
            >
              <span>When</span>
              <Input
                id="card-when"
                type="date"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                disabled={!canEdit}
              />
            </label>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> People on this
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {people.map((person) => {
                const checked = personIds.includes(person.id);
                return (
                  <label
                    key={person.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                      checked
                        ? "border-primary/35 bg-primary/8"
                        : "border-border bg-background/35 hover:bg-muted/60",
                      !canEdit && "cursor-default opacity-70",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit}
                      onChange={() =>
                        setPersonIds((current) =>
                          checked
                            ? current.filter((id) => id !== person.id)
                            : [...current, person.id],
                        )
                      }
                      className="sr-only"
                    />
                    <Avatar name={person.name} src={person.image} />
                    <span className="flex-1 text-sm font-medium">
                      {person.name}
                    </span>
                    {checked ? <Check className="size-4 text-primary" /> : null}
                  </label>
                );
              })}
            </div>
          </section>

          {availableTags.length ? (
            <section className="space-y-3">
              <div className="text-sm font-semibold">Tags</div>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const checked = tagIds.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      disabled={!canEdit}
                      onClick={() =>
                        setTagIds((current) =>
                          checked
                            ? current.filter((id) => id !== tag.id)
                            : [...current, tag.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        checked
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {checked ? "✓ " : ""}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-border bg-background/30 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={blocked}
                onChange={(event) => setBlocked(event.target.checked)}
                disabled={!canEdit}
                className="size-4 accent-[var(--primary)]"
              />
              This is waiting on something
            </label>
            {blocked ? (
              <Input
                value={blockedReason}
                onChange={(event) => setBlockedReason(event.target.value)}
                disabled={!canEdit}
                placeholder="What are we waiting on?"
              />
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Checklist</div>
              <span className="text-xs text-muted-foreground">
                {card.checklist.filter((item) => item.complete).length}/
                {card.checklist.length}
              </span>
            </div>
            <div className="space-y-2">
              {card.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={item.complete}
                    disabled={!canEdit}
                    onChange={async (event) => {
                      try {
                        await api(
                          `/api/cards/${card.id}/checklist/${item.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({
                              complete: event.target.checked,
                            }),
                          },
                        );
                        await onChanged();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Checklist could not be updated.",
                        );
                      }
                    }}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                  />
                  <span
                    className={cn(
                      "leading-5",
                      item.complete && "text-muted-foreground line-through",
                    )}
                  >
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                <Input
                  value={newChecklist}
                  onChange={(event) => setNewChecklist(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addChecklist();
                    }
                  }}
                  placeholder="Add a small next step"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void addChecklist()}
                  aria-label="Add checklist item"
                >
                  <Plus />
                </Button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GitPullRequest className="size-4" /> GitHub issues
            </div>
            <div className="space-y-2">
              {card.links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/35 p-3"
                >
                  <GitPullRequest className="size-4 text-muted-foreground" />
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline"
                  >
                    {link.owner}/{link.repo}#{link.issueNumber}
                  </a>
                  <Badge variant="neutral">{link.state}</Badge>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Remove ${link.owner}/${link.repo} issue ${link.issueNumber}`}
                      onClick={async () => {
                        try {
                          await api(`/api/cards/${card.id}/links/${link.id}`, {
                            method: "DELETE",
                          });
                          await onChanged();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Link could not be removed.",
                          );
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                <Input
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addGithub();
                    }
                  }}
                  placeholder="https://github.com/owner/repo/issues/123"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void addGithub()}
                >
                  <Link2 /> Link
                </Button>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="size-4 text-primary" /> Notes from
              people
            </div>
            <div className="space-y-4">
              {card.comments.map((comment) => {
                const author = data.people.find(
                  (person) => person.id === comment.authorId,
                );
                return (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar
                      name={author?.name ?? "Former member"}
                      src={author?.image}
                    />
                    <div className="min-w-0 flex-1 rounded-xl border border-border bg-background/35 px-4 py-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">
                          {author?.name ?? "Former member"}
                        </span>
                        <time className="text-[11px] text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}
                        </time>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {canEdit ? (
              <div className="space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Leave a helpful note…"
                  className="min-h-24"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void addComment()}
                  >
                    Add note
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-primary" /> What Changed
            </div>
            {cardActivity.length ? (
              <ol className="space-y-3 border-l border-border pl-4">
                {cardActivity.map((activity) => {
                  const actor = data.people.find(
                    (person) => person.id === activity.actorId,
                  );
                  return (
                    <li key={activity.id} className="text-sm">
                      <p className="leading-5 text-foreground">
                        <span className="font-semibold">
                          {actor?.name ?? "A former member"}
                        </span>{" "}
                        {activity.summary}
                      </p>
                      <time className="mt-1 block text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </time>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No changes have been recorded yet.
              </p>
            )}
          </section>
        </div>

        {canEdit ? (
          <div className="sticky bottom-0 flex justify-end border-t border-border bg-card/95 px-6 py-4 backdrop-blur sm:px-8">
            <Button onClick={() => void save()} disabled={saving}>
              <Save /> {saving ? "Saving…" : "Save card"}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
