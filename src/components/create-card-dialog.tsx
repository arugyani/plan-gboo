import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  Board,
  BoardColumn,
  CreateCardInput,
  Importance,
  Person,
} from "@/types";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export function CreateCardDialog({
  open,
  onOpenChange,
  board,
  columns,
  people,
  onCreate,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  columns: BoardColumn[];
  people: Person[];
  onCreate: (input: CreateCardInput) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [importance, setImportance] = useState<Importance>("none");
  const [when, setWhen] = useState("");
  const [personIds, setPersonIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    // Reset the destination when this reusable dialog opens on another board.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnId(columns[0]?.id ?? "");
  }, [columns, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !columnId) return;
    await onCreate({
      boardId: board.id,
      columnId,
      title: title.trim(),
      notes: notes.trim(),
      importance,
      when: when || null,
      personIds,
    });
    setTitle("");
    setNotes("");
    setImportance("none");
    setWhen("");
    setPersonIds([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a card</DialogTitle>
          <DialogDescription>
            Add something to {board.name}. You can fill in the rest now or come
            back later.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-medium">
            What’s the card about?
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A clear, short title"
              maxLength={40}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Notes
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, links, or what a good result looks like. Markdown is supported."
              maxLength={600}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Column
              <select
                className={selectClass}
                value={columnId}
                onChange={(event) => setColumnId(event.target.value)}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Importance
              <select
                className={selectClass}
                value={importance}
                onChange={(event) =>
                  setImportance(event.target.value as Importance)
                }
              >
                <option value="none">No flag</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              When
              <Input
                type="date"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
              />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">People on this</legend>
            <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
              {people.map((person) => (
                <label
                  key={person.id}
                  className="flex min-h-8 items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={personIds.includes(person.id)}
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
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim() || !columnId}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
              Add card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
