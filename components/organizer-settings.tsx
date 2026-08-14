"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Users } from "lucide-react";
import { toast } from "sonner";
import type {
  Board,
  DashboardData,
  Group,
  GroupRole,
  NotificationPreferences,
} from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

async function api(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? "That change could not be saved.",
    );
  return payload;
}

export function GroupSettingsDialog({
  group,
  data,
  open,
  onOpenChange,
  onChanged,
}: {
  group: Group | null;
  data: DashboardData;
  open: boolean;
  onOpenChange(open: boolean): void;
  onChanged(): Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<Group["icon"]>("ghost");
  const [accent, setAccent] = useState<Group["accent"]>("pumpkin");
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [recapEnabled, setRecapEnabled] = useState(false);
  const [recapHourUtc, setRecapHourUtc] = useState(15);
  const [newTag, setNewTag] = useState("");
  const [tagColor, setTagColor] = useState<
    "pumpkin" | "purple" | "green" | "berry"
  >("purple");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!group) return;
    // Reset the local draft when an organizer opens another group.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(group.name);
    setIcon(group.icon);
    setAccent(group.accent);
    setDiscordChannelId(group.discordChannelId ?? "");
    setRecapEnabled(group.recapEnabled);
    setRecapHourUtc(group.recapHourUtc);
    setNewTag("");
  }, [group]);

  if (!group) return null;

  const saveGroup = async () => {
    setSaving(true);
    try {
      await api(`/api/groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          icon,
          accent,
          discordChannelId,
          recapEnabled,
          recapHourUtc,
        }),
      });
      await onChanged();
      toast.success("Group updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That group could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };

  const setMembership = async (userId: string, role: GroupRole | null) => {
    try {
      await api(`/api/groups/${group.id}/members`, {
        method: "PUT",
        body: JSON.stringify({ userId, role }),
      });
      await onChanged();
      toast.success("Group access updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That access change could not be saved.",
      );
      await onChanged();
    }
  };

  const addTag = async () => {
    if (!newTag.trim()) return;
    try {
      await api(`/api/groups/${group.id}/tags`, {
        method: "POST",
        body: JSON.stringify({ name: newTag, color: tagColor }),
      });
      setNewTag("");
      await onChanged();
      toast.success("Tag added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That tag could not be added.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Organize {group.name}</DialogTitle>
          <DialogDescription>
            Choose its look and who can gather here. People can belong to as
            many groups as they need.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-4 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-3">
          <label
            htmlFor="group-settings-name"
            className="space-y-2 text-sm font-semibold sm:col-span-3"
          >
            Group name
            <Input
              id="group-settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Icon
            <select
              value={icon}
              onChange={(event) => setIcon(event.target.value as Group["icon"])}
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
            >
              <option value="ghost">Ghost</option>
              <option value="pumpkin">Pumpkin</option>
              <option value="bat">Bat</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">
            Accent
            <select
              value={accent}
              onChange={(event) =>
                setAccent(event.target.value as Group["accent"])
              }
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
            >
              <option value="pumpkin">Pumpkin orange</option>
              <option value="purple">Muted purple</option>
              <option value="green">Moss green</option>
              <option value="berry">Berry</option>
            </select>
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-background/30 p-4">
          <div>
            <div className="text-sm font-semibold">Discord updates</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Optional public recap for this group. Copy the channel ID from
              Discord developer mode.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <label
              htmlFor="group-discord-channel"
              className="space-y-2 text-sm font-semibold"
            >
              Channel ID
              <Input
                id="group-discord-channel"
                inputMode="numeric"
                value={discordChannelId}
                onChange={(event) =>
                  setDiscordChannelId(event.target.value.replace(/\D/g, ""))
                }
                placeholder="123456789012345678"
              />
            </label>
            <label
              htmlFor="group-recap-hour"
              className="space-y-2 text-sm font-semibold"
            >
              Hour (UTC)
              <Input
                id="group-recap-hour"
                type="number"
                min={0}
                max={23}
                value={recapHourUtc}
                onChange={(event) =>
                  setRecapHourUtc(Number(event.target.value))
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={recapEnabled}
              disabled={!discordChannelId}
              onChange={(event) => setRecapEnabled(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Share one daily board recap in this channel
          </label>
        </section>

        <section className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Card tags</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reusable labels for this group’s cards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.tags
              .filter((tag) => tag.groupId === group.id)
              .map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold"
                >
                  {tag.name}
                </span>
              ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
            <Input
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addTag();
                }
              }}
              placeholder="A short tag"
              aria-label="New tag name"
            />
            <label>
              <span className="sr-only">New tag color</span>
              <select
                value={tagColor}
                onChange={(event) =>
                  setTagColor(
                    event.target.value as
                      | "pumpkin"
                      | "purple"
                      | "green"
                      | "berry",
                  )
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="pumpkin">Pumpkin</option>
                <option value="purple">Purple</option>
                <option value="green">Green</option>
                <option value="berry">Berry</option>
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void addTag()}
              disabled={!newTag.trim()}
            >
              <Plus /> Add
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" /> People in this group
          </div>
          <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
            {data.people.map((person) => {
              const role = person.groupRoles[group.id] ?? "";
              return (
                <div key={person.id} className="flex items-center gap-3 p-3">
                  <Avatar name={person.name} src={person.image} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {person.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {person.active ? "Connected" : "Access paused"}
                    </div>
                  </div>
                  <label>
                    <span className="sr-only">
                      {person.name} role in {group.name}
                    </span>
                    <select
                      value={role}
                      disabled={!person.active}
                      onChange={(event) =>
                        void setMembership(
                          person.id,
                          (event.target.value || null) as GroupRole | null,
                        )
                      }
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                    >
                      <option value="">No access</option>
                      <option value="view_only">View only</option>
                      <option value="member">Member</option>
                      <option value="organizer">Organizer</option>
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <DialogFooter>
          <Button
            onClick={() => void saveGroup()}
            disabled={saving || !name.trim()}
          >
            <Save /> {saving ? "Saving…" : "Save group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BoardSettingsDialog({
  board,
  data,
  open,
  onOpenChange,
  onChanged,
}: {
  board: Board | null;
  data: DashboardData;
  open: boolean;
  onOpenChange(open: boolean): void;
  onChanged(): Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const columns = data.columns
    .filter((column) => column.boardId === board?.id)
    .sort((a, b) => a.rank - b.rank);

  useEffect(() => {
    if (!board) return;
    // Reset the local draft when an organizer opens another board.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(board.name);
    setNote(board.note);
    setColumnNames(
      Object.fromEntries(
        data.columns
          .filter((column) => column.boardId === board.id)
          .map((column) => [column.id, column.name]),
      ),
    );
  }, [board, data.columns]);

  if (!board) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/boards/${board.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, note }),
      });
      for (const column of columns) {
        const nextName = columnNames[column.id]?.trim();
        if (nextName && nextName !== column.name) {
          await api(`/api/boards/${board.id}/columns/${column.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: nextName }),
          });
        }
      }
      await onChanged();
      toast.success("Board updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That board could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };

  const reorder = async (columnId: string, direction: "up" | "down") => {
    try {
      await api(`/api/boards/${board.id}/columns/${columnId}`, {
        method: "PATCH",
        body: JSON.stringify({ direction }),
      });
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That column could not be moved.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Organize {board.name}</DialogTitle>
          <DialogDescription>
            Keep the board language familiar to the people using it.
          </DialogDescription>
        </DialogHeader>
        <label
          htmlFor="board-settings-name"
          className="space-y-2 text-sm font-semibold"
        >
          Board name
          <Input
            id="board-settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label
          htmlFor="board-settings-note"
          className="space-y-2 text-sm font-semibold"
        >
          A short note
          <Textarea
            id="board-settings-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20"
            maxLength={500}
          />
        </label>
        <section className="space-y-3">
          <div className="text-sm font-semibold">Columns</div>
          <div className="space-y-2">
            {columns.map((column, index) => (
              <div key={column.id} className="flex items-center gap-2">
                <Input
                  value={columnNames[column.id] ?? column.name}
                  onChange={(event) =>
                    setColumnNames((current) => ({
                      ...current,
                      [column.id]: event.target.value,
                    }))
                  }
                  aria-label={`${column.name} column name`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => void reorder(column.id, "up")}
                  aria-label={`Move ${column.name} left`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === columns.length - 1}
                  onClick={() => void reorder(column.id, "down")}
                  aria-label={`Move ${column.name} right`}
                >
                  <ArrowDown />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Renaming a column keeps every card in place. Reordering changes the
            board layout for everyone.
          </p>
        </section>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            <Save /> {saving ? "Saving…" : "Save board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NotificationSettingsDialog({
  data,
  open,
  onOpenChange,
  onChanged,
}: {
  data: DashboardData;
  open: boolean;
  onOpenChange(open: boolean): void;
  onChanged(): Promise<void> | void;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    data.notificationPreferences,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Keep the draft in sync when the background refresh receives a saved copy.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(data.notificationPreferences);
  }, [data.notificationPreferences]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
      });
      await onChanged();
      onOpenChange(false);
      toast.success("Notification choices saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Those choices could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your notification choices</DialogTitle>
          <DialogDescription>
            Choose the nudges that are useful. Discord messages stay private
            unless a recap is deliberately shared.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {(
            [
              ["assignments", "When someone puts you on a card"],
              ["mentions", "When someone mentions you in a note"],
              ["dueSoon", "When a date is getting close"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
                className="size-4 accent-[var(--primary)]"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            htmlFor="notification-digest"
            className="space-y-2 text-sm font-semibold"
          >
            Recap
            <select
              id="notification-digest"
              value={preferences.digest}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  digest: event.target
                    .value as NotificationPreferences["digest"],
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label
            htmlFor="notification-timezone"
            className="space-y-2 text-sm font-semibold"
          >
            Timezone
            <Input
              id="notification-timezone"
              value={preferences.timezone}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
              placeholder="America/New_York"
            />
          </label>
          <label
            htmlFor="quiet-start"
            className="space-y-2 text-sm font-semibold"
          >
            Quiet time starts
            <Input
              id="quiet-start"
              type="time"
              value={preferences.quietStart ?? ""}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  quietStart: event.target.value || null,
                }))
              }
            />
          </label>
          <label
            htmlFor="quiet-end"
            className="space-y-2 text-sm font-semibold"
          >
            Quiet time ends
            <Input
              id="quiet-end"
              type="time"
              value={preferences.quietEnd ?? ""}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  quietEnd: event.target.value || null,
                }))
              }
            />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            <Save /> {saving ? "Saving…" : "Save choices"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
