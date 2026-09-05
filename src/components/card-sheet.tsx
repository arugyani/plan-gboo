import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  ExternalLink,
  GitPullRequest,
  History,
  Link2,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/utils";
import type {
  BoardColumn,
  Card,
  CardPatch,
  Importance,
  Person,
  Tag,
} from "@/types";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50";

const MarkdownNotes = lazy(() =>
  import("@/components/markdown-notes").then((module) => ({
    default: module.MarkdownNotes,
  })),
);

export function CardSheet({
  card,
  open,
  onOpenChange,
  columns,
  people,
  tags,
  viewerId,
  canEdit,
  busy,
  onSave,
  onMove,
  canMoveUp,
  canMoveDown,
  onReorder,
  onAddComment,
  onAddChecklistItem,
  onSetChecklistItem,
  onAddGitHubLink,
  onRemoveGitHubLink,
}: {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: BoardColumn[];
  people: Person[];
  tags: Tag[];
  viewerId: string;
  canEdit: boolean;
  busy: boolean;
  onSave: (patch: CardPatch) => Promise<void>;
  onMove: (columnId: string, expectedVersion: number) => Promise<void>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onReorder: (
    direction: "up" | "down",
    expectedVersion: number,
  ) => Promise<void>;
  onAddComment: (body: string) => Promise<void>;
  onAddChecklistItem: (text: string) => Promise<void>;
  onSetChecklistItem: (itemId: string, complete: boolean) => Promise<void>;
  onAddGitHubLink: (url: string) => Promise<void>;
  onRemoveGitHubLink: (linkId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [importance, setImportance] = useState<Importance>("none");
  const [when, setWhen] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [notesMode, setNotesMode] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (!card) return;
    // The sheet is a draft editor; a freshly selected or refreshed card must
    // replace any unsaved values left from the previous selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(card.title);
    setNotes(card.notes);
    setImportance(card.importance);
    setWhen(card.when ?? "");
    setBlockedReason(card.blockedReason ?? "");
    setPersonIds(card.personIds);
    setTagIds(card.tagIds);
    setNewTag("");
    setNewTagNames([]);
    setNotesMode("write");
  }, [card]);

  if (!card) return null;

  const doneColumn = columns.find(
    (column) => column.name.toLowerCase() === "done",
  );
  const assigned = people.filter((person) =>
    card.personIds.includes(person.id),
  );
  const completed = card.checklist.filter((item) => item.complete).length;

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!card) return;
    await onSave({
      title: title.trim(),
      notes,
      importance,
      when: when || null,
      blocked: card.blocked,
      blockedReason: card.blocked
        ? blockedReason.trim() || "Waiting on an update"
        : null,
      personIds,
      tagIds,
      tagNames: [
        ...tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name),
        ...newTagNames,
      ],
      expectedVersion: card.version,
    });
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    await onAddComment(comment.trim());
    setComment("");
  }

  async function addChecklist(event: FormEvent) {
    event.preventDefault();
    if (!checklistText.trim()) return;
    await onAddChecklistItem(checklistText.trim());
    setChecklistText("");
  }

  async function addLink(event: FormEvent) {
    event.preventDefault();
    if (!githubUrl.trim()) return;
    await onAddGitHubLink(githubUrl.trim());
    setGithubUrl("");
  }

  function addTag(event: FormEvent) {
    event.preventDefault();
    const name = newTag.trim();
    if (!name) return;
    const existing = tags.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      setTagIds((current) =>
        current.includes(existing.id) ? current : [...current, existing.id],
      );
    } else {
      setNewTagNames((current) =>
        current.some((tag) => tag.toLowerCase() === name.toLowerCase())
          ? current
          : [...current, name],
      );
    }
    setNewTag("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={`card-${card.id}-description`}>
        <form
          onSubmit={save}
          className="border-b border-border px-5 pb-5 pt-6 sm:px-7"
        >
          <div className="mb-5 pr-12">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="neutral">{card.key}</Badge>
              {card.blocked ? <Badge variant="danger">Waiting</Badge> : null}
            </div>
            <SheetTitle className="sr-only">{card.title}</SheetTitle>
            <SheetDescription
              id={`card-${card.id}-description`}
              className="sr-only"
            >
              View and update this card.
            </SheetDescription>
            <Textarea
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!canEdit}
              aria-label="Card title"
              maxLength={40}
              rows={2}
              className="min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-1 text-xl font-bold leading-7 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Column
              <select
                className={selectClass}
                value={card.columnId}
                onChange={(event) => onMove(event.target.value, card.version)}
                disabled={!canEdit || busy}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Importance
              <select
                className={selectClass}
                value={importance}
                onChange={(event) =>
                  setImportance(event.target.value as Importance)
                }
                disabled={!canEdit}
              >
                <option value="none">No flag</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="col-span-2 grid gap-1.5 text-xs font-semibold text-muted-foreground sm:col-span-1">
              When
              <Input
                type="date"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                disabled={!canEdit}
              />
            </label>
          </div>

          {canEdit ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onReorder("up", card.version)}
                disabled={busy || !canMoveUp}
              >
                <ArrowUp /> Move up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onReorder("down", card.version)}
                disabled={busy || !canMoveDown}
              >
                <ArrowDown /> Move down
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  card.personIds.includes(viewerId) ? "secondary" : "outline"
                }
                onClick={() =>
                  onSave({
                    personIds: card.personIds.includes(viewerId)
                      ? card.personIds.filter((id) => id !== viewerId)
                      : [...card.personIds, viewerId],
                    expectedVersion: card.version,
                  })
                }
                disabled={busy}
              >
                <UserPlus />
                {card.personIds.includes(viewerId) ? "Leave this" : "Join this"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={card.blocked ? "secondary" : "outline"}
                onClick={() =>
                  onSave({
                    blocked: !card.blocked,
                    blockedReason: !card.blocked
                      ? blockedReason || "Waiting on an update"
                      : null,
                    expectedVersion: card.version,
                  })
                }
                disabled={busy}
              >
                <CircleAlert /> {card.blocked ? "No longer waiting" : "Waiting"}
              </Button>
              {doneColumn && card.columnId !== doneColumn.id ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onMove(doneColumn.id, card.version)}
                  disabled={busy}
                >
                  <Check /> Mark done
                </Button>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="divide-y divide-border px-5 sm:px-7">
          <section className="py-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Notes</h3>
              {canEdit ? (
                <div
                  className="flex rounded-lg border border-border p-0.5"
                  aria-label="Notes mode"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={notesMode === "write" ? "secondary" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                    aria-pressed={notesMode === "write"}
                    onClick={() => setNotesMode("write")}
                  >
                    Write
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={notesMode === "preview" ? "secondary" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                    aria-pressed={notesMode === "preview"}
                    onClick={() => setNotesMode("preview")}
                  >
                    Preview
                  </Button>
                </div>
              ) : null}
            </div>
            {canEdit && notesMode === "write" ? (
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add context, links, or what a good result looks like. Markdown is supported."
                aria-label="Card notes"
                className="min-h-28"
                maxLength={600}
              />
            ) : notes.trim() ? (
              <Suspense
                fallback={
                  <div
                    className="grid min-h-28 place-items-center rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground"
                    role="status"
                  >
                    Opening preview…
                  </div>
                }
              >
                <MarkdownNotes className="min-h-28 rounded-lg border border-border bg-background p-3">
                  {notes}
                </MarkdownNotes>
              </Suspense>
            ) : (
              <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
                No notes yet
              </div>
            )}
            {card.blocked ? (
              <label className="mt-3 grid gap-1.5 text-xs font-semibold text-muted-foreground">
                What are we waiting on?
                <Input
                  value={blockedReason}
                  onChange={(event) => setBlockedReason(event.target.value)}
                  disabled={!canEdit}
                  placeholder="A short reason"
                  maxLength={300}
                />
              </label>
            ) : null}
            {card.discordMessageUrl ? (
              <Button asChild variant="outline" className="mt-3">
                <a
                  href={card.discordMessageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink /> Open Discord message
                </a>
              </Button>
            ) : null}
          </section>

          <section className="py-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">People on this</h3>
              <div className="flex -space-x-2">
                {assigned.map((person) => (
                  <Avatar
                    key={person.id}
                    name={person.name}
                    src={person.image}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {people.map((person) => (
                <label
                  key={person.id}
                  className="flex min-h-9 items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={personIds.includes(person.id)}
                    disabled={!canEdit}
                    onCheckedChange={(checked) =>
                      setPersonIds((current) =>
                        checked
                          ? [...current, person.id]
                          : current.filter((id) => id !== person.id),
                      )
                    }
                  />
                  {person.name}
                </label>
              ))}
            </div>
          </section>

          <section className="py-6">
            <h3 className="mb-3 text-sm font-bold">Tags</h3>
            {tags.length || newTagNames.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"
                  >
                    <Checkbox
                      checked={tagIds.includes(tag.id)}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        setTagIds((current) =>
                          checked
                            ? [...current, tag.id]
                            : current.filter((id) => id !== tag.id),
                        )
                      }
                    />
                    {tag.name}
                  </label>
                ))}
                {newTagNames.map((tag) => (
                  <span
                    key={tag.toLowerCase()}
                    className="flex min-h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setNewTagNames((current) =>
                          current.filter((name) => name !== tag),
                        )
                      }
                      className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {canEdit ? (
              <form onSubmit={addTag} className="mt-3 flex gap-2">
                <Input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder="Add a tag"
                  aria-label="New tag"
                  maxLength={30}
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  disabled={
                    busy ||
                    !newTag.trim() ||
                    tagIds.length + newTagNames.length >= 10
                  }
                >
                  <Plus /> <span className="sr-only">Add tag</span>
                </Button>
              </form>
            ) : null}
          </section>

          <section className="py-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <ListChecks className="size-4 text-muted-foreground" />{" "}
                Checklist
              </h3>
              {card.checklist.length ? (
                <span className="text-xs text-muted-foreground">
                  {completed} of {card.checklist.length}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {card.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-9 items-start gap-3 text-sm leading-5"
                >
                  <Checkbox
                    checked={item.complete}
                    disabled={!canEdit || busy}
                    onCheckedChange={(checked) =>
                      onSetChecklistItem(item.id, Boolean(checked))
                    }
                    className="mt-0.5"
                  />
                  <span
                    className={
                      item.complete ? "text-muted-foreground line-through" : ""
                    }
                  >
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
            {canEdit ? (
              <form onSubmit={addChecklist} className="mt-3 flex gap-2">
                <Input
                  value={checklistText}
                  onChange={(event) => setChecklistText(event.target.value)}
                  placeholder="Add a checklist item"
                  aria-label="New checklist item"
                  maxLength={240}
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  disabled={busy || !checklistText.trim()}
                >
                  <Plus /> <span className="sr-only">Add checklist item</span>
                </Button>
              </form>
            ) : null}
          </section>

          <section className="py-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <GitPullRequest className="size-4 text-muted-foreground" /> GitHub
              issues
            </h3>
            <div className="space-y-2">
              {card.links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 text-sm font-medium text-violet-800 hover:underline"
                  >
                    <span className="block truncate">
                      {link.owner}/{link.repo}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Issue #{link.issueNumber} · {link.state}
                    </span>
                  </a>
                  <div className="flex items-center gap-1">
                    <Button asChild size="icon" variant="ghost">
                      <a href={link.url} target="_blank" rel="noreferrer">
                        <ExternalLink />{" "}
                        <span className="sr-only">Open issue</span>
                      </a>
                    </Button>
                    {canEdit ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemoveGitHubLink(link.id)}
                        disabled={busy}
                      >
                        <Trash2 />{" "}
                        <span className="sr-only">Remove issue link</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {canEdit ? (
              <form onSubmit={addLink} className="mt-3 flex gap-2">
                <Input
                  type="url"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo/issues/123"
                  aria-label="GitHub issue URL"
                  maxLength={2048}
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  disabled={busy || !githubUrl.trim()}
                >
                  <Link2 /> <span className="sr-only">Link GitHub issue</span>
                </Button>
              </form>
            ) : null}
          </section>

          <section className="py-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <MessageSquare className="size-4 text-muted-foreground" /> Notes
              from the group
            </h3>
            <div className="space-y-4">
              {card.comments.map((entry) => {
                const author = people.find(
                  (person) => person.id === entry.authorId,
                );
                return (
                  <article key={entry.id} className="flex gap-3">
                    <Avatar
                      name={author?.name ?? "Former member"}
                      src={author?.image}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {author?.name ?? "Former member"}
                        </p>
                        <time className="text-[11px] text-muted-foreground">
                          {relativeTime(entry.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {entry.body}
                      </p>
                    </div>
                  </article>
                );
              })}
              {!card.comments.length ? (
                <p className="text-sm text-muted-foreground">
                  No notes yet. Start the thread here.
                </p>
              ) : null}
            </div>
            {canEdit ? (
              <form onSubmit={addComment} className="mt-4 space-y-2">
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Add a note for everyone…"
                  className="min-h-20"
                  minLength={10}
                  maxLength={600}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={busy || comment.trim().length < 10}
                  >
                    <MessageSquare /> Add note
                  </Button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="py-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <History className="size-4 text-muted-foreground" /> What Changed
            </h3>
            {(card.changes ?? []).length ? (
              <ol className="space-y-4">
                {(card.changes ?? []).map((change) => {
                  const actor = people.find(
                    (person) => person.id === change.actorId,
                  );
                  return (
                    <li key={change.id} className="flex gap-3">
                      <Avatar
                        name={actor?.name ?? "The Board"}
                        src={actor?.image}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-5">{change.summary}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {actor?.name ?? "The Board"} ·{" "}
                          <time>{relativeTime(change.createdAt)}</time>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Earlier changes were not recorded for this card.
              </p>
            )}
          </section>
        </div>

        {canEdit ? (
          <div className="sticky bottom-0 flex items-center justify-end border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-7">
            <Button
              type="button"
              onClick={() => save()}
              disabled={busy || !title.trim()}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
