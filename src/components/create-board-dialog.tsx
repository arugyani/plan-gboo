import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CreateBoardInput, Group } from "@/types";

export function CreateBoardDialog({
  groups,
  busy,
  onCreate,
  onClose,
}: {
  groups: Group[];
  busy: boolean;
  onCreate: (input: CreateBoardInput) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a board</DialogTitle>
          <DialogDescription>
            Everyone in the chosen group can see this board.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              busy ||
              !name.trim() ||
              !groups.some((group) => group.id === groupId)
            )
              return;
            setError("");
            void onCreate({ name: name.trim(), groupId })
              .then(onClose)
              .catch((cause: Error) => setError(cause.message));
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Board name
            <Input
              autoFocus
              value={name}
              maxLength={50}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Group
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={groupId}
              disabled={busy}
              onChange={(event) => setGroupId(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
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
            <Button type="submit" disabled={busy || !name.trim() || !groupId}>
              {busy ? "Adding…" : "Add board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
