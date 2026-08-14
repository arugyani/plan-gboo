"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  announce,
  cleanup as cleanupLiveRegion,
} from "@atlaskit/pragmatic-drag-and-drop-live-region";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Ghost,
  GitPullRequest,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogIn,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type {
  Board,
  Card,
  DashboardData,
  Group,
  Importance,
} from "@/lib/types";
import { cn, formatRelativeDate } from "@/lib/utils";
import { CardEditor } from "./card-editor";
import {
  BoardSettingsDialog,
  GroupSettingsDialog,
  NotificationSettingsDialog,
} from "./organizer-settings";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
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

type View = "my-list" | "boards" | "groups" | "people" | "activity";

interface ApiFailure extends Error {
  status?: number;
}

async function getDashboard(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const error = new Error(
      payload?.error?.message ?? "The Board could not be loaded.",
    ) as ApiFailure;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<DashboardData>;
}

async function api<T>(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? "That change could not be saved.",
    );
  return payload as T;
}

const navItems: Array<{ id: View; label: string; icon: typeof ListChecks }> = [
  { id: "my-list", label: "My List", icon: ListChecks },
  { id: "boards", label: "Boards", icon: LayoutDashboard },
  { id: "groups", label: "Groups", icon: Ghost },
  { id: "people", label: "People", icon: Users },
  { id: "activity", label: "What’s Happening", icon: Activity },
];

const accentClasses: Record<Group["accent"], string> = {
  pumpkin: "group-accent-pumpkin",
  purple: "group-accent-purple",
  green: "group-accent-green",
  berry: "group-accent-berry",
};

function canEditBoard(data: DashboardData, boardId: string) {
  const board = data.boards.find((item) => item.id === boardId);
  if (!board) return false;
  if (data.viewer.systemRole === "admin") return true;
  const role = data.viewer.groupRoles[board.groupId];
  return role === "organizer" || role === "member";
}

function canOrganizeGroup(data: DashboardData, groupId: string) {
  return (
    data.viewer.systemRole === "admin" ||
    data.viewer.groupRoles[groupId] === "organizer"
  );
}

function GroupMark({ group, className }: { group: Group; className?: string }) {
  const source =
    group.icon === "bat"
      ? "/openmoji-bat.svg"
      : group.icon === "pumpkin"
        ? "/openmoji-pumpkin.svg"
        : "/openmoji-ghost.svg";
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/5",
        accentClasses[group.accent],
        className,
      )}
    >
      <Image
        src={source}
        alt=""
        width={24}
        height={24}
        className="size-5"
        unoptimized
      />
    </span>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-primary/20 bg-primary/8 text-primary shadow-[0_0_50px_rgba(238,117,42,0.08)]">
        <Ghost className="size-8" />
      </div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

function CardTile({
  card,
  data,
  dragEnabled,
  onOpen,
  onMove,
}: {
  card: Card;
  data: DashboardData;
  dragEnabled: boolean;
  onOpen(): void;
  onMove(columnId: string, beforeCardId?: string | null): void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const board = data.boards.find((item) => item.id === card.boardId);
  const columns = data.columns
    .filter((item) => item.boardId === card.boardId)
    .sort((a, b) => a.rank - b.rank);
  const currentCards = data.cards
    .filter((item) => item.columnId === card.columnId)
    .sort((a, b) => a.rank - b.rank);
  const cardIndex = currentCards.findIndex((item) => item.id === card.id);
  const people = card.personIds
    .map((id) => data.people.find((person) => person.id === id))
    .filter(Boolean);
  const doneCount = card.checklist.filter((item) => item.complete).length;
  const editable = canEditBoard(data, card.boardId);

  useEffect(() => {
    const element = cardRef.current;
    const handle = handleRef.current;
    if (!element || !handle || !dragEnabled || !editable) return;
    return combine(
      draggable({
        element,
        dragHandle: handle,
        getInitialData: () => ({ type: "board-card", cardId: card.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element,
        getData: () => ({
          type: "card-target",
          cardId: card.id,
          columnId: card.columnId,
        }),
        canDrop: ({ source }) =>
          source.data.type === "board-card" && source.data.cardId !== card.id,
        onDragEnter: () => setOver(true),
        onDragLeave: () => setOver(false),
        onDrop: () => setOver(false),
      }),
    );
  }, [card.id, card.columnId, dragEnabled, editable]);

  const moveUp = () => {
    if (cardIndex > 0) onMove(card.columnId, currentCards[cardIndex - 1]?.id);
  };
  const moveDown = () => {
    if (cardIndex < currentCards.length - 1) {
      onMove(card.columnId, currentCards[cardIndex + 2]?.id ?? null);
    }
  };

  return (
    <article
      ref={cardRef}
      data-card-id={card.id}
      className={cn(
        "card-tile relative rounded-xl border border-border bg-card p-3.5 shadow-sm transition-[opacity,border-color,transform,box-shadow]",
        "hover:border-white/15 hover:shadow-lg",
        dragging && "opacity-45",
        over &&
          "-translate-y-0.5 border-primary/70 shadow-[0_-3px_0_var(--primary)]",
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        {dragEnabled && editable ? (
          <button
            ref={handleRef}
            type="button"
            className="mt-0.5 grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag ${card.title}`}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          data-card-open
          onClick={onOpen}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {card.key}
          </span>
          <span className="mt-1 block text-sm font-semibold leading-5 text-foreground">
            {card.title}
          </span>
        </button>
      </div>

      {card.blocked ? (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs leading-4 text-[#ffaaa0]">
          <CircleDot className="mt-0.5 size-3 shrink-0" />
          <span>{card.blockedReason || "Waiting on something"}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {card.importance !== "none" ? (
          <Badge variant={card.importance === "urgent" ? "danger" : "neutral"}>
            {card.importance}
          </Badge>
        ) : null}
        {card.when ? (
          <Badge variant="neutral">
            <CalendarDays /> {formatRelativeDate(card.when)}
          </Badge>
        ) : null}
        {card.links.length ? (
          <Badge variant="purple">
            <GitPullRequest /> {card.links.length}
          </Badge>
        ) : null}
        {card.checklist.length ? (
          <Badge variant="neutral">
            <CheckCircle2 /> {doneCount}/{card.checklist.length}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
        <div
          className="flex -space-x-1.5"
          aria-label={
            people.length
              ? `People: ${people.map((person) => person?.name).join(", ")}`
              : "No one is on this card"
          }
        >
          {people
            .slice(0, 3)
            .map((person) =>
              person ? (
                <Avatar
                  key={person.id}
                  name={person.name}
                  src={person.image}
                  className="size-6 ring-2 ring-card"
                />
              ) : null,
            )}
          {!people.length ? (
            <span className="text-[11px] text-muted-foreground">
              No one yet
            </span>
          ) : null}
        </div>
        {editable && dragEnabled ? (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={cardIndex <= 0}
              onClick={moveUp}
              aria-label={`Move ${card.title} up`}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={cardIndex >= currentCards.length - 1}
              onClick={moveDown}
              aria-label={`Move ${card.title} down`}
            >
              <ArrowDown />
            </Button>
            <label className="relative">
              <span className="sr-only">Move {card.title} to column</span>
              <select
                value={card.columnId}
                onChange={(event) => onMove(event.target.value, null)}
                className="h-7 max-w-24 appearance-none rounded-md border border-transparent bg-transparent py-0 pl-2 pr-6 text-[11px] text-muted-foreground hover:border-border hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            </label>
          </div>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">
            {board?.name}
          </span>
        )}
      </div>
    </article>
  );
}

function BoardLane({
  columnId,
  data,
  cards,
  onAdd,
  onOpen,
  onMove,
}: {
  columnId: string;
  data: DashboardData;
  cards: Card[];
  onAdd(): void;
  onOpen(card: Card): void;
  onMove(card: Card, columnId: string, beforeCardId?: string | null): void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [over, setOver] = useState(false);
  const column = data.columns.find((item) => item.id === columnId)!;
  const editable = canEditBoard(data, column.boardId);

  useEffect(() => {
    const element = ref.current;
    if (!element || !editable) return;
    return dropTargetForElements({
      element,
      getData: () => ({ type: "column-target", columnId }),
      canDrop: ({ source }) => source.data.type === "board-card",
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    });
  }, [columnId, editable]);

  return (
    <section
      ref={ref}
      className={cn(
        "board-lane flex min-h-[22rem] w-[19rem] shrink-0 flex-col rounded-2xl border border-border bg-column/80 p-2.5",
        over && "border-primary/50 bg-primary/5",
      )}
      aria-labelledby={`column-${column.id}`}
    >
      <div className="flex items-center gap-2 px-1.5 pb-3 pt-1">
        <span
          className={cn("column-dot", `column-dot-${column.color}`)}
          aria-hidden
        />
        <h3
          id={`column-${column.id}`}
          className="text-xs font-bold uppercase tracking-[0.13em]"
        >
          {column.name}
        </h3>
        <Badge variant="neutral" className="ml-auto min-w-6 justify-center">
          {cards.length}
        </Badge>
      </div>
      <div className="space-y-2.5">
        {cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            data={data}
            dragEnabled
            onOpen={() => onOpen(card)}
            onMove={(destination, before) => onMove(card, destination, before)}
          />
        ))}
      </div>
      {editable ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full justify-start text-muted-foreground"
          onClick={onAdd}
        >
          <Plus /> Add a card
        </Button>
      ) : null}
    </section>
  );
}

function CreateCardDialog({
  data,
  board,
  open,
  onOpenChange,
  onCreated,
}: {
  data: DashboardData;
  board: Board | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(): Promise<void> | void;
}) {
  const columns = useMemo(
    () =>
      data.columns
        .filter((item) => item.boardId === board?.id)
        .sort((a, b) => a.rank - b.rank),
    [data.columns, board?.id],
  );
  const [title, setTitle] = useState("");
  const [columnId, setColumnId] = useState("");
  const [importance, setImportance] = useState<Importance>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset the destination when the dialog is reopened for another board.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColumnId(columns[0]?.id ?? "");
    }
  }, [open, board?.id, columns]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!board || !title.trim() || !columnId) return;
    setSaving(true);
    try {
      await api("/api/cards", {
        method: "POST",
        body: JSON.stringify({
          boardId: board.id,
          columnId,
          title,
          importance,
        }),
      });
      setTitle("");
      setImportance("none");
      onOpenChange(false);
      await onCreated();
      toast.success("Card added");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That card could not be added.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a card</DialogTitle>
            <DialogDescription>
              Put a clear thought on {board?.name ?? "this board"}. You can fill
              in the details after.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="new-card-title"
            className="block space-y-2 text-sm font-semibold"
          >
            What should we remember?
            <Input
              id="new-card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A short, useful title"
              maxLength={160}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold">
              Start in
              <select
                value={columnId}
                onChange={(event) => setColumnId(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold">
              Importance
              <select
                value={importance}
                onChange={(event) =>
                  setImportance(event.target.value as Importance)
                }
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
              >
                <option value="none">No preference</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Plus />}{" "}
              {saving ? "Adding…" : "Add card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SimpleCreateDialog({
  kind,
  data,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: "group" | "board";
  data: DashboardData;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(): Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(
    data.groups.find((group) => canOrganizeGroup(data, group.id))?.id ?? "",
  );
  const title = kind === "group" ? "Add a group" : "Add a board";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api(kind === "group" ? "/api/groups" : "/api/boards", {
        method: "POST",
        body: JSON.stringify(kind === "group" ? { name } : { name, groupId }),
      });
      setName("");
      onOpenChange(false);
      await onCreated();
      toast.success(kind === "group" ? "Group added" : "Board added");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `That ${kind} could not be added.`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {kind === "group"
                ? "Groups keep boards and access together."
                : "A board is a comfortable home for related cards."}
            </DialogDescription>
          </DialogHeader>
          {kind === "board" ? (
            <label className="block space-y-2 text-sm font-semibold">
              Group
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
              >
                {data.groups
                  .filter((group) => canOrganizeGroup(data, group.id))
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label
            htmlFor={`${kind}-name`}
            className="block space-y-2 text-sm font-semibold"
          >
            Name
            <Input
              id={`${kind}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === "group" ? "Lantern Crew" : "Opening Week"}
            />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>
              <Plus /> {title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BoardApp() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });
  const data = dashboard.data;
  const [view, setView] = useState<View>("boards");
  const [boardId, setBoardId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [savedViewName, setSavedViewName] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] =
    useState(false);
  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => cleanupLiveRegion, []);

  useEffect(() => {
    // These defaults are established only after the first dashboard response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data && !boardId) setBoardId(data.boards[0]?.id ?? "all");
    if (data && !selectedBoardIds.length)
      setSelectedBoardIds(data.boards.map((board) => board.id));
    if (data && !selectedCardId) {
      const requestedKey = new URLSearchParams(window.location.search).get(
        "card",
      );
      const requestedCard = data.cards.find(
        (card) => card.key.toLowerCase() === requestedKey?.toLowerCase(),
      );
      if (requestedCard) {
        setBoardId(requestedCard.boardId);
        setSelectedCardId(requestedCard.id);
        setView("boards");
      }
    }
  }, [data, boardId, selectedBoardIds.length, selectedCardId]);

  const selectedBoard =
    data?.boards.find((board) => board.id === boardId) ?? null;
  const selectedGroup =
    data?.groups.find((group) => group.id === selectedBoard?.groupId) ?? null;
  const selectedCard =
    data?.cards.find((card) => card.id === selectedCardId) ?? null;
  const settingsGroup =
    data?.groups.find((group) => group.id === settingsGroupId) ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updatePersonAccess = async (
    personId: string,
    patch: { systemRole?: "admin" | "member"; active?: boolean },
  ) => {
    try {
      await api(`/api/people/${personId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refresh();
      toast.success("Account access updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That access change could not be saved.",
      );
      await refresh();
    }
  };

  const moveCard = async (
    card: Card,
    columnId: string,
    beforeCardId?: string | null,
  ) => {
    if (!data || (card.columnId === columnId && beforeCardId === card.id))
      return;
    const previous = data;
    queryClient.setQueryData<DashboardData>(["dashboard"], (current) => {
      if (!current) return current;
      const without = current.cards.filter((item) => item.id !== card.id);
      const destination = without
        .filter((item) => item.columnId === columnId)
        .sort((a, b) => a.rank - b.rank);
      const index = beforeCardId
        ? destination.findIndex((item) => item.id === beforeCardId)
        : destination.length;
      const safeIndex = index < 0 ? destination.length : index;
      const moved = {
        ...card,
        columnId,
        rank: safeIndex * 1024 + 512,
        version: card.version + 1,
      };
      const nextDestination = [
        ...destination.slice(0, safeIndex),
        moved,
        ...destination.slice(safeIndex),
      ].map((item, order) => ({ ...item, rank: (order + 1) * 1024 }));
      const destinationIds = new Set(nextDestination.map((item) => item.id));
      return {
        ...current,
        cards: [
          ...without.filter((item) => !destinationIds.has(item.id)),
          ...nextDestination,
        ],
      };
    });
    const destinationName = data.columns.find(
      (column) => column.id === columnId,
    )?.name;
    announce(
      destinationName
        ? `${card.title} moved to ${destinationName}.`
        : `${card.title} moved.`,
    );
    try {
      await api(`/api/cards/${card.id}/move`, {
        method: "POST",
        body: JSON.stringify({
          columnId,
          beforeCardId: beforeCardId ?? null,
          expectedVersion: card.version,
        }),
      });
      await refresh();
    } catch (error) {
      queryClient.setQueryData(["dashboard"], previous);
      announce(`${card.title} was restored because the move could not save.`);
      toast.error(
        error instanceof Error
          ? error.message
          : "That card could not be moved.",
        {
          description: "Your board has been restored to the last saved order.",
        },
      );
      await refresh();
    }
  };

  useEffect(() => {
    if (!data || boardId === "all") return;
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === "board-card",
      onDrop: ({ source, location }) => {
        const card = data.cards.find((item) => item.id === source.data.cardId);
        if (!card) return;
        const target =
          location.current.dropTargets.find(
            (item) => item.data.type === "card-target",
          ) ??
          location.current.dropTargets.find(
            (item) => item.data.type === "column-target",
          );
        if (!target) return;
        const destination = String(target.data.columnId ?? "");
        const before =
          target.data.type === "card-target"
            ? String(target.data.cardId)
            : null;
        if (destination) void moveCard(card, destination, before);
      },
    });
    // moveCard intentionally closes over the same dashboard snapshot that
    // registered this monitor; a refresh replaces both together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, boardId]);

  if (dashboard.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Lighting the lanterns…
          </p>
        </div>
      </main>
    );
  }

  if (dashboard.isError || !data) {
    const unauthorized = (dashboard.error as ApiFailure | null)?.status === 401;
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Ghost className="size-8" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold">
            {unauthorized ? "Come on in" : "The lantern went out"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {unauthorized
              ? "Sign in with Discord to see the groups and boards shared with you."
              : dashboard.error?.message}
          </p>
          {unauthorized ? (
            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={() =>
                void authClient.signIn.social({
                  provider: "discord",
                  callbackURL: "/",
                })
              }
            >
              <LogIn /> Continue with Discord
            </Button>
          ) : (
            <Button className="mt-6" onClick={() => void dashboard.refetch()}>
              Try again
            </Button>
          )}
        </div>
      </main>
    );
  }

  const boardCards = data.cards
    .filter((card) =>
      boardId === "all"
        ? selectedBoardIds.includes(card.boardId)
        : card.boardId === boardId,
    )
    .filter(
      (card) =>
        !search ||
        `${card.key} ${card.title} ${card.notes}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const myCards = data.cards.filter((card) =>
    card.personIds.includes(data.viewer.id),
  );

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-sidebar px-3 py-4 transition-transform lg:sticky lg:top-0 lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-2 pb-6 pt-1">
          <div className="logo-mark grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Ghost className="size-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-none">
              The Board
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Gather around
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <nav aria-label="Main navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  setMobileNavOpen(false);
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  view === item.id
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Your groups
        </div>
        <div className="mt-2 space-y-1 overflow-y-auto">
          {data.groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                const firstBoard = data.boards.find(
                  (board) => board.groupId === group.id,
                );
                if (firstBoard) {
                  setBoardId(firstBoard.id);
                  setView("boards");
                }
                setMobileNavOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <GroupMark group={group} className="size-7 rounded-lg" />
              <span className="truncate">{group.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNotificationSettingsOpen(true)}
          className="mt-auto flex items-center gap-3 rounded-xl border border-border bg-background/30 p-2.5 text-left hover:bg-muted/50"
        >
          <Avatar name={data.viewer.name} src={data.viewer.image} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {data.viewer.name}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {data.viewer.systemRole === "admin" ? "Admin" : "Member"}
            </div>
          </div>
          <Settings2 className="size-4 text-muted-foreground" />
        </button>
      </aside>
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation backdrop"
        />
      ) : null}

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a card…"
              className="pl-9"
              aria-label="Find a card"
            />
          </div>
          {data.demoMode ? (
            <Badge variant="purple" className="hidden sm:inline-flex">
              <Sparkles /> Demo
            </Badge>
          ) : null}
          <Avatar
            name={data.viewer.name}
            src={data.viewer.image}
            className="lg:hidden"
          />
        </header>

        {view === "boards" ? (
          <div className="min-h-[calc(100vh-4rem)]">
            <section
              className={cn(
                "board-hero border-b border-border px-4 py-6 sm:px-6 lg:px-8",
                selectedGroup && accentClasses[selectedGroup.accent],
              )}
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-start gap-4">
                  {selectedGroup ? (
                    <GroupMark
                      group={selectedGroup}
                      className="size-12 rounded-2xl"
                    />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <BookOpen />
                    </span>
                  )}
                  <div>
                    <div className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--group-accent,var(--primary))]">
                      {selectedGroup?.name ?? "Across your groups"}
                    </div>
                    <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                      {selectedBoard?.name ?? "All Together"}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                      {selectedBoard?.note ??
                        "A calm, combined view of the groups you choose. Moving is paused here because each board has its own flow."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative">
                    <span className="sr-only">Choose a board</span>
                    <select
                      value={boardId}
                      onChange={(event) => setBoardId(event.target.value)}
                      className="h-10 min-w-48 appearance-none rounded-lg border border-border bg-card py-2 pl-3 pr-9 text-sm font-semibold"
                    >
                      <option value="all">All Together</option>
                      {data.groups.map((group) => (
                        <optgroup key={group.id} label={group.name}>
                          {data.boards
                            .filter((board) => board.groupId === group.id)
                            .map((board) => (
                              <option key={board.id} value={board.id}>
                                {board.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </label>
                  {selectedBoard && canEditBoard(data, selectedBoard.id) ? (
                    <Button onClick={() => setCreateCardOpen(true)}>
                      <Plus /> Add a card
                    </Button>
                  ) : null}
                  {selectedGroup && canOrganizeGroup(data, selectedGroup.id) ? (
                    <Button
                      variant="outline"
                      onClick={() => setBoardSettingsOpen(true)}
                    >
                      <Settings2 /> Organize
                    </Button>
                  ) : null}
                  {boardId === "all" ? (
                    <Button
                      variant="outline"
                      onClick={() => setSaveViewOpen(true)}
                    >
                      <Plus /> Save view
                    </Button>
                  ) : null}
                  {data.groups.some((group) =>
                    canOrganizeGroup(data, group.id),
                  ) ? (
                    <Button
                      variant="outline"
                      onClick={() => setCreateBoardOpen(true)}
                    >
                      <Plus /> Board
                    </Button>
                  ) : null}
                </div>
              </div>
              {boardId === "all" ? (
                <div
                  className="mt-5 flex flex-wrap gap-2"
                  aria-label="Groups in this combined view"
                >
                  {data.groups.map((group) => {
                    const groupBoardIds = data.boards
                      .filter((item) => item.groupId === group.id)
                      .map((item) => item.id);
                    const active =
                      groupBoardIds.length > 0 &&
                      groupBoardIds.every((id) =>
                        selectedBoardIds.includes(id),
                      );
                    return (
                      <button
                        type="button"
                        key={group.id}
                        onClick={() =>
                          setSelectedBoardIds((current) =>
                            active
                              ? current.filter(
                                  (id) => !groupBoardIds.includes(id),
                                )
                              : [...new Set([...current, ...groupBoardIds])],
                          )
                        }
                        aria-pressed={active}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "border-primary/35 bg-primary/12 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {group.name}
                      </button>
                    );
                  })}
                  <span className="mx-1 h-6 w-px bg-border" aria-hidden />
                  {data.boards.map((item) => {
                    const active = selectedBoardIds.includes(item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() =>
                          setSelectedBoardIds((current) =>
                            active
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                        aria-pressed={active}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition",
                          active
                            ? "border-white/15 bg-muted text-foreground"
                            : "border-border/70 text-muted-foreground",
                        )}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {boardId === "all" && data.savedViews.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Saved
                  </span>
                  {data.savedViews.map((view) => (
                    <span
                      key={view.id}
                      className="inline-flex items-center rounded-full border border-border bg-card"
                    >
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-semibold hover:text-primary"
                        onClick={() => setSelectedBoardIds(view.boardIds)}
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        className="mr-1 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Delete ${view.name}`}
                        onClick={async () => {
                          try {
                            await api(`/api/views/${view.id}`, {
                              method: "DELETE",
                            });
                            await refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "That saved view could not be removed.",
                            );
                          }
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            {selectedBoard ? (
              <div className="board-scroll overflow-x-auto px-4 py-5 sm:px-6 lg:px-8">
                <div className="flex min-w-max gap-3.5">
                  {data.columns
                    .filter((column) => column.boardId === selectedBoard.id)
                    .sort((a, b) => a.rank - b.rank)
                    .map((column) => (
                      <BoardLane
                        key={column.id}
                        columnId={column.id}
                        data={data}
                        cards={boardCards
                          .filter((card) => card.columnId === column.id)
                          .sort((a, b) => a.rank - b.rank)}
                        onAdd={() => setCreateCardOpen(true)}
                        onOpen={(card) => setSelectedCardId(card.id)}
                        onMove={moveCard}
                      />
                    ))}
                </div>
              </div>
            ) : boardCards.length ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 2xl:grid-cols-4 lg:p-8">
                {boardCards.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    data={data}
                    dragEnabled={false}
                    onOpen={() => setSelectedCardId(card.id)}
                    onMove={() => undefined}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing haunting this view"
                copy="Choose another group, or add a card to one of your boards."
              />
            )}
          </div>
        ) : null}

        {view === "my-list" ? (
          <section className="p-4 sm:p-6 lg:p-8">
            <div className="mb-7">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Just for you
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold">
                My List
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Everything you’re part of, gathered in one place.
              </p>
            </div>
            {myCards.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {myCards.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    data={data}
                    dragEnabled={false}
                    onOpen={() => setSelectedCardId(card.id)}
                    onMove={() => undefined}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Your list is clear"
                copy="Join a card when something catches your eye."
              />
            )}
          </section>
        ) : null}

        {view === "groups" ? (
          <section className="p-4 sm:p-6 lg:p-8">
            <div className="mb-7 flex items-end justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Gathering places
                </div>
                <h1 className="mt-1 font-display text-3xl font-semibold">
                  Groups
                </h1>
              </div>
              {data.viewer.systemRole === "admin" ? (
                <Button onClick={() => setCreateGroupOpen(true)}>
                  <Plus /> Add a group
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.groups.map((group) => (
                <article
                  key={group.id}
                  className={cn(
                    "group-card rounded-2xl border border-border bg-card p-5",
                    accentClasses[group.accent],
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GroupMark group={group} className="size-12 rounded-2xl" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-lg font-semibold">
                        {group.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {data.viewer.systemRole === "admin"
                          ? "Admin"
                          : (
                              data.viewer.groupRoles[group.id] ?? "View only"
                            ).replace("_", " ")}
                      </p>
                    </div>
                    {canOrganizeGroup(data, group.id) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSettingsGroupId(group.id)}
                      >
                        <Settings2 /> Organize
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <strong className="block text-lg">
                        {
                          data.boards.filter(
                            (board) => board.groupId === group.id,
                          ).length
                        }
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        Boards
                      </span>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <strong className="block text-lg">
                        {
                          data.people.filter((person) =>
                            Boolean(person.groupRoles[group.id]),
                          ).length
                        }
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        People
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === "people" ? (
          <section className="p-4 sm:p-6 lg:p-8">
            <div className="mb-7">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Around the table
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold">
                People
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Discord identities and the groups each person can see.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="divide-y divide-border">
                {data.people.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <Avatar
                      name={person.name}
                      src={person.image}
                      className="size-11"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {person.name}{" "}
                        {person.id === data.viewer.id ? (
                          <span className="text-xs font-normal text-primary">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {person.active
                          ? "Connected through Discord"
                          : "Access paused"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.groups
                        .filter((group) => person.groupRoles[group.id])
                        .map((group) => (
                          <Badge key={group.id} variant="neutral">
                            {group.name} ·{" "}
                            {person.groupRoles[group.id]?.replace("_", " ")}
                          </Badge>
                        ))}
                    </div>
                    {data.viewer.systemRole === "admin" &&
                    person.id !== data.viewer.id ? (
                      <div className="flex items-center gap-2">
                        <label>
                          <span className="sr-only">
                            {person.name} account role
                          </span>
                          <select
                            value={person.systemRole}
                            disabled={!person.active}
                            onChange={(event) =>
                              void updatePersonAccess(person.id, {
                                systemRole: event.target.value as
                                  | "admin"
                                  | "member",
                              })
                            }
                            className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void updatePersonAccess(person.id, {
                              active: !person.active,
                            })
                          }
                        >
                          {person.active ? "Pause access" : "Restore access"}
                        </Button>
                      </div>
                    ) : person.systemRole === "admin" ? (
                      <Badge variant="purple">Admin</Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === "activity" ? (
          <section className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
            <div className="mb-7">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                The trail so far
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold">
                What’s Happening
              </h1>
            </div>
            {data.activity.length ? (
              <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[1.18rem] before:top-4 before:w-px before:bg-border">
                {data.activity.map((item) => {
                  const actor = data.people.find(
                    (person) => person.id === item.actorId,
                  );
                  const card = data.cards.find(
                    (cardItem) => cardItem.id === item.cardId,
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => card && setSelectedCardId(card.id)}
                      className="relative flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition hover:border-white/15"
                    >
                      <span className="z-10 grid size-9 shrink-0 place-items-center rounded-full border border-primary/25 bg-background text-primary">
                        <Activity className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">
                          <strong>{actor?.name ?? "Someone"}</strong>{" "}
                          {item.summary}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="All quiet for now"
                copy="New cards, moves, and notes will leave a friendly trail here."
              />
            )}
          </section>
        ) : null}
      </main>

      <CreateCardDialog
        data={data}
        board={selectedBoard}
        open={createCardOpen}
        onOpenChange={setCreateCardOpen}
        onCreated={refresh}
      />
      <SimpleCreateDialog
        kind="group"
        data={data}
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onCreated={refresh}
      />
      <SimpleCreateDialog
        kind="board"
        data={data}
        open={createBoardOpen}
        onOpenChange={setCreateBoardOpen}
        onCreated={refresh}
      />
      <BoardSettingsDialog
        board={selectedBoard}
        data={data}
        open={boardSettingsOpen}
        onOpenChange={setBoardSettingsOpen}
        onChanged={refresh}
      />
      <GroupSettingsDialog
        group={settingsGroup}
        data={data}
        open={Boolean(settingsGroup)}
        onOpenChange={(open) => {
          if (!open) setSettingsGroupId(null);
        }}
        onChanged={refresh}
      />
      <NotificationSettingsDialog
        data={data}
        open={notificationSettingsOpen}
        onOpenChange={setNotificationSettingsOpen}
        onChanged={refresh}
      />
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
            <DialogDescription>
              Keep this mix of boards handy for the next time you open All
              Together.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="saved-view-name"
            className="space-y-2 text-sm font-semibold"
          >
            View name
            <Input
              id="saved-view-name"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              placeholder="This week’s gathering"
            />
          </label>
          <DialogFooter>
            <Button
              disabled={!savedViewName.trim() || !selectedBoardIds.length}
              onClick={async () => {
                try {
                  await api("/api/views", {
                    method: "POST",
                    body: JSON.stringify({
                      name: savedViewName,
                      boardIds: selectedBoardIds,
                      filters: {},
                    }),
                  });
                  setSavedViewName("");
                  setSaveViewOpen(false);
                  await refresh();
                  toast.success("View saved");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "That view could not be saved.",
                  );
                }
              }}
            >
              <Plus /> Save view
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CardEditor
        card={selectedCard}
        data={data}
        open={Boolean(selectedCard)}
        onOpenChange={(open) => {
          if (!open) {
            const cardId = selectedCardId;
            setSelectedCardId(null);
            window.requestAnimationFrame(() => {
              const trigger = cardId
                ? document.querySelector<HTMLButtonElement>(
                    `[data-card-id="${cardId}"] [data-card-open]`,
                  )
                : null;
              trigger?.focus();
            });
          }
        }}
        onChanged={refresh}
      />
    </div>
  );
}
