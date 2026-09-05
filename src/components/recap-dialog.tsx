import { Check, Clipboard, CircleAlert, MoonStar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Board, BoardColumn, Card } from "@/types";

export function RecapDialog({
  open,
  onOpenChange,
  board,
  columns,
  cards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  columns: BoardColumn[];
  cards: Card[];
}) {
  const doneColumn = columns.find(
    (column) => column.name.toLowerCase() === "done",
  );
  const done = cards.filter((card) => card.columnId === doneColumn?.id);
  const waiting = cards.filter((card) => card.blocked);
  const active = cards.filter(
    (card) => card.columnId !== doneColumn?.id && !card.blocked,
  );
  const recap = [
    `**${board.name} recap**`,
    `In motion: ${active.length} · Waiting: ${waiting.length} · Done: ${done.length}`,
    active.length
      ? `\n**In motion**\n${active
          .slice(0, 5)
          .map((card) => `• ${card.key} ${card.title}`)
          .join("\n")}`
      : "",
    waiting.length
      ? `\n**Waiting**\n${waiting.map((card) => `• ${card.key} ${card.title}`).join("\n")}`
      : "",
    done.length
      ? `\n**Recently done**\n${done
          .slice(0, 5)
          .map((card) => `• ${card.key} ${card.title}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  async function copyRecap() {
    try {
      await navigator.clipboard.writeText(recap);
      toast.success("Recap copied for Discord");
    } catch {
      toast.error(
        "The recap could not be copied. Select the text and copy it.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <MoonStar className="size-5" />
          </div>
          <DialogTitle>{board.name} recap</DialogTitle>
          <DialogDescription>
            A quick snapshot you can copy straight into Discord.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted p-3">
            <div className="text-xl font-bold">{active.length}</div>
            <div className="text-xs text-muted-foreground">In motion</div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3 text-rose-800">
            <div className="flex items-center gap-1 text-xl font-bold">
              <CircleAlert className="size-4" /> {waiting.length}
            </div>
            <div className="text-xs text-rose-700">Waiting</div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
            <div className="flex items-center gap-1 text-xl font-bold">
              <Check className="size-4" /> {done.length}
            </div>
            <div className="text-xs text-emerald-700">Done</div>
          </div>
        </div>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 font-sans text-sm leading-6">
          {recap}
        </pre>
        <Button onClick={copyRecap}>
          <Clipboard /> Copy for Discord
        </Button>
      </DialogContent>
    </Dialog>
  );
}
