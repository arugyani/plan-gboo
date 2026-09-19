import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Board, BoardColumn, Card } from "@/types";

export function MoveBoardDialog({
  card,
  boards,
  columns,
  busy,
  onMove,
  onClose,
}: {
  card: Card;
  boards: Board[];
  columns: BoardColumn[];
  busy: boolean;
  onMove: (boardId: string, columnId: string, version: number) => Promise<void>;
  onClose: () => void;
}) {
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [columnId, setColumnId] = useState("");
  const [version] = useState(card.version);
  const [error, setError] = useState("");
  const destinations = columns
    .filter((column) => column.boardId === boardId)
    .sort((a, b) => a.rank - b.rank);
  const selectedColumnId = destinations.some((column) => column.id === columnId)
    ? columnId
    : (destinations[0]?.id ?? "");
  const selectClass =
    "h-10 rounded-lg border border-input bg-background px-3 text-sm";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {card.key} to another board</DialogTitle>
          <DialogDescription>
            Moves the saved card, including its notes and history. Save any
            edits first. People in the destination group will be able to see it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              busy ||
              !selectedColumnId ||
              !boards.some((board) => board.id === boardId)
            )
              return;
            setError("");
            void onMove(boardId, selectedColumnId, version)
              .then(onClose)
              .catch((cause: Error) => setError(cause.message));
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Destination board
            <select
              autoFocus
              className={selectClass}
              value={boardId}
              disabled={busy}
              onChange={(event) => {
                setBoardId(event.target.value);
                setColumnId("");
              }}
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Destination column
            <select
              className={selectClass}
              value={selectedColumnId}
              disabled={busy}
              onChange={(event) => setColumnId(event.target.value)}
            >
              {destinations.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !selectedColumnId}>
              {busy ? "Moving…" : "Move card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
