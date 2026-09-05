import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Board,
  BoardColumn,
  CreateBoardInput,
  CreateGroupInput,
  Group,
  UpdateBoardInput,
} from "@/types";

export function GroupDialog({
  open,
  onOpenChange,
  busy,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onCreate: (input: CreateGroupInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<Group["icon"]>("ghost");
  const [accent, setAccent] = useState<Group["accent"]>("purple");
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setName("");
      setIcon("ghost");
      setAccent("purple");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a group</DialogTitle>
          <DialogDescription>
            Group access stays private until you add people.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim())
              void onCreate({ name: name.trim(), icon, accent })
                .then(() => handleOpenChange(false))
                .catch(() => undefined);
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Name
            <Input
              autoFocus
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm font-semibold">
              Icon
              <select
                value={icon}
                onChange={(event) =>
                  setIcon(event.target.value as Group["icon"])
                }
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="ghost">Ghost</option>
                <option value="pumpkin">Pumpkin</option>
                <option value="bat">Bat</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Accent
              <select
                value={accent}
                onChange={(event) =>
                  setAccent(event.target.value as Group["accent"])
                }
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="purple">Purple</option>
                <option value="pumpkin">Pumpkin</option>
                <option value="green">Green</option>
                <option value="berry">Berry</option>
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Add group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BoardDialog({
  open,
  onOpenChange,
  group,
  busy,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
  busy: boolean;
  onCreate: (input: CreateBoardInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setName("");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a board</DialogTitle>
          <DialogDescription>{group.name}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim())
              void onCreate({ name: name.trim(), groupId: group.id })
                .then(() => handleOpenChange(false))
                .catch(() => undefined);
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Name
            <Input
              autoFocus
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Add board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ColumnDialog({
  open,
  onOpenChange,
  board,
  columns,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  columns: BoardColumn[];
  busy: boolean;
  onSave: (input: UpdateBoardInput) => Promise<void>;
}) {
  const sortedColumns = () =>
    [...columns]
      .sort((a, b) => a.rank - b.rank)
      .map((column, index) => ({ ...column, rank: (index + 1) * 1024 }));
  const [draft, setDraft] = useState(sortedColumns);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(sortedColumns());
    onOpenChange(nextOpen);
  };
  const move = (index: number, offset: -1 | 1) => {
    const destination = index + offset;
    if (destination < 0 || destination >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next.map((column, columnIndex) => ({
        ...column,
        rank: (columnIndex + 1) * 1024,
      }));
    });
  };
  const names = draft.map((column) => column.name.trim().toLowerCase());
  const valid =
    draft.length === 5 &&
    names.every(Boolean) &&
    new Set(names).size === draft.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Board columns</DialogTitle>
          <DialogDescription>{board.name}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            void onSave({
              columns: draft.map(({ id, name, rank, color }) => ({
                id,
                name: name.trim(),
                rank,
                color,
              })),
            })
              .then(() => handleOpenChange(false))
              .catch(() => undefined);
          }}
        >
          {draft.map((column, index) => (
            <div key={column.id} className="flex items-center gap-2">
              <Input
                aria-label={`Column ${index + 1} name`}
                maxLength={30}
                value={column.name}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((item) =>
                      item.id === column.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <select
                aria-label={`Color for ${column.name}`}
                value={column.color}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((item) =>
                      item.id === column.id
                        ? { ...item, color: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 w-28 rounded-lg border border-input bg-background px-2 text-xs"
              >
                <option value="purple">Purple</option>
                <option value="pumpkin">Pumpkin</option>
                <option value="green">Green</option>
                <option value="berry">Berry</option>
                <option value="neutral">Neutral</option>
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === 0}
                aria-label={`Move ${column.name} up`}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === draft.length - 1}
                aria-label={`Move ${column.name} down`}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
            </div>
          ))}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !valid}>
              Save columns
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
