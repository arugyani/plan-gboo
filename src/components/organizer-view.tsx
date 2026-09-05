import { useState } from "react";
import {
  Candy,
  Ghost,
  LayoutDashboard,
  ListOrdered,
  Pencil,
  Plus,
  MoonStar,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BoardDialog,
  ColumnDialog,
  GroupDialog,
} from "@/components/organizer-dialogs";
import { cn } from "@/lib/utils";
import type {
  Board,
  CreateBoardInput,
  CreateGroupInput,
  DashboardData,
  Group,
  GroupRole,
  UpdateBoardInput,
  UpdateGroupInput,
} from "@/types";

const roleLabels: Record<GroupRole, string> = {
  organizer: "Organizer",
  member: "Member",
  view_only: "View only",
};

function canManageGroup(data: DashboardData, groupId: string) {
  return (
    data.viewer.systemRole === "admin" ||
    data.viewer.groupRoles[groupId] === "organizer"
  );
}

function GroupMark({ group }: { group: Group }) {
  const Icon =
    group.icon === "bat" ? MoonStar : group.icon === "pumpkin" ? Candy : Ghost;
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg",
        group.accent === "pumpkin" && "bg-orange-100 text-orange-800",
        group.accent === "purple" && "bg-violet-100 text-violet-800",
        group.accent === "green" && "bg-emerald-100 text-emerald-800",
        group.accent === "berry" && "bg-rose-100 text-rose-800",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function GroupsView({
  data,
  busy,
  onCreateGroup,
  onUpdateGroup,
  onSetRole,
  onRemovePerson,
  onCreateBoard,
  onUpdateBoard,
  onDeleteBoard,
  onDeleteGroup,
}: {
  data: DashboardData;
  busy: boolean;
  onCreateGroup: (input: CreateGroupInput) => Promise<void>;
  onUpdateGroup: (groupId: string, input: UpdateGroupInput) => Promise<void>;
  onSetRole: (
    groupId: string,
    personId: string,
    role: GroupRole,
  ) => Promise<void>;
  onRemovePerson: (groupId: string, personId: string) => Promise<void>;
  onCreateBoard: (input: CreateBoardInput) => Promise<void>;
  onUpdateBoard: (boardId: string, input: UpdateBoardInput) => Promise<void>;
  onDeleteBoard: (boardId: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(data.groups[0]?.id ?? "");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const selected =
    data.groups.find((group) => group.id === selectedId) ?? data.groups[0];

  if (!selected) return null;
  const manageable = canManageGroup(data, selected.id);
  const members = data.people.filter(
    (person) => person.groupRoles[selected.id],
  );
  const availablePeople = data.people.filter(
    (person) => person.active && !person.groupRoles[selected.id],
  );
  const boards = data.boards.filter((board) => board.groupId === selected.id);
  const canCreateGroups =
    data.viewer.systemRole === "admin" ||
    data.groups.some(
      (group) =>
        !group.isPrivate && data.viewer.groupRoles[group.id] === "organizer",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
        {canCreateGroups ? (
          <Button onClick={() => setGroupDialogOpen(true)}>
            <Plus /> Add group
          </Button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          aria-label="Groups"
          className="h-fit space-y-1 rounded-xl border border-border bg-card p-2"
        >
          {data.groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedId(group.id)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted",
                selected.id === group.id && "bg-muted font-semibold",
              )}
            >
              <GroupMark group={group} />
              <span className="truncate">{group.name}</span>
            </button>
          ))}
        </nav>

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <GroupMark group={selected} />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">{selected.name}</h2>
                <Badge variant={selected.isPrivate ? "neutral" : "green"}>
                  {selected.isPrivate ? "Private group" : "Everyone"}
                </Badge>
              </div>
            </div>

            {manageable && selected.isPrivate ? (
              <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold">
                  Icon
                  <select
                    value={selected.icon}
                    disabled={busy}
                    onChange={(event) =>
                      void onUpdateGroup(selected.id, {
                        icon: event.target.value as Group["icon"],
                      })
                    }
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="ghost">Ghost</option>
                    <option value="pumpkin">Pumpkin</option>
                    <option value="bat">Bat</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold">
                  Accent
                  <select
                    value={selected.accent}
                    disabled={busy}
                    onChange={(event) =>
                      void onUpdateGroup(selected.id, {
                        accent: event.target.value as Group["accent"],
                      })
                    }
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="pumpkin">Pumpkin</option>
                    <option value="purple">Purple</option>
                    <option value="green">Green</option>
                    <option value="berry">Berry</option>
                  </select>
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="font-bold">Boards</h2>
              {manageable ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBoardDialogOpen(true)}
                >
                  <Plus /> Add board
                </Button>
              ) : null}
            </div>
            <div className="divide-y divide-border">
              {boards.map((board) => (
                <BoardRow
                  key={board.id}
                  board={board}
                  columns={data.columns.filter(
                    (column) => column.boardId === board.id,
                  )}
                  manageable={manageable}
                  busy={busy}
                  onRename={onUpdateBoard}
                  onDelete={onDeleteBoard}
                />
              ))}
              {!boards.length ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  No boards in this group.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-bold">People</h2>
            </div>
            {manageable && selected.isPrivate && availablePeople.length ? (
              <AddPersonRow
                groupId={selected.id}
                people={availablePeople}
                busy={busy}
                onSetRole={onSetRole}
              />
            ) : null}
            <div className="divide-y divide-border">
              {members.map((person) => (
                <div
                  key={person.id}
                  className="flex min-h-16 items-center gap-3 px-5 py-3"
                >
                  <Avatar name={person.name} src={person.image} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {person.name}
                  </span>
                  {manageable && selected.isPrivate ? (
                    <select
                      aria-label={`Role for ${person.name}`}
                      value={person.groupRoles[selected.id]}
                      disabled={busy}
                      onChange={(event) =>
                        void onSetRole(
                          selected.id,
                          person.id,
                          event.target.value as GroupRole,
                        )
                      }
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
                    >
                      {Object.entries(roleLabels).map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="neutral">
                      {roleLabels[person.groupRoles[selected.id]]}
                    </Badge>
                  )}
                  {manageable &&
                  selected.isPrivate &&
                  person.id !== data.viewer.id ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Remove ${person.name} from ${selected.name}`}
                      onClick={() =>
                        void onRemovePerson(selected.id, person.id)
                      }
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {manageable && selected.isPrivate ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={busy || boards.length > 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${selected.name}? This cannot be undone.`,
                    )
                  )
                    void onDeleteGroup(selected.id);
                }}
              >
                <Trash2 /> Delete group
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        busy={busy}
        onCreate={onCreateGroup}
      />
      <BoardDialog
        open={boardDialogOpen}
        onOpenChange={setBoardDialogOpen}
        group={selected}
        busy={busy}
        onCreate={onCreateBoard}
      />
    </div>
  );
}

function AddPersonRow({
  groupId,
  people,
  busy,
  onSetRole,
}: {
  groupId: string;
  people: DashboardData["people"];
  busy: boolean;
  onSetRole: (
    groupId: string,
    personId: string,
    role: GroupRole,
  ) => Promise<void>;
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const selectedPersonId = people.some((person) => person.id === personId)
    ? personId
    : (people[0]?.id ?? "");
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center">
      <UserPlus className="hidden size-4 text-muted-foreground sm:block" />
      <select
        aria-label="Person to add"
        value={selectedPersonId}
        onChange={(event) => setPersonId(event.target.value)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
      >
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={busy || !selectedPersonId}
        onClick={() => void onSetRole(groupId, selectedPersonId, "member")}
      >
        Add person
      </Button>
    </div>
  );
}

function BoardRow({
  board,
  columns,
  manageable,
  busy,
  onRename,
  onDelete,
}: {
  board: Board;
  columns: DashboardData["columns"];
  manageable: boolean;
  busy: boolean;
  onRename: (boardId: string, input: UpdateBoardInput) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  return (
    <>
      <div className="flex min-h-14 items-center gap-3 px-5 py-3">
        <LayoutDashboard className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {board.name}
        </span>
        {manageable ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`Configure columns for ${board.name}`}
              onClick={() => setColumnsOpen(true)}
            >
              <ListOrdered />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`Rename ${board.name}`}
              onClick={() => {
                const name = window.prompt("Board name", board.name)?.trim();
                if (name && name !== board.name)
                  void onRename(board.id, { name });
              }}
            >
              <Pencil />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`Delete ${board.name}`}
              onClick={() => {
                if (window.confirm(`Delete ${board.name}?`))
                  void onDelete(board.id);
              }}
            >
              <Trash2 />
            </Button>
          </>
        ) : null}
      </div>
      <ColumnDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        board={board}
        columns={columns}
        busy={busy}
        onSave={(input) => onRename(board.id, input)}
      />
    </>
  );
}
