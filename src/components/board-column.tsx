import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { BoardCard } from "@/components/board-card";
import { cn } from "@/lib/utils";
import type { BoardColumn as Column, Card, Person, Tag } from "@/types";

export function BoardColumn({
  column,
  cards,
  people,
  tags,
  canDrag,
  onOpenCard,
}: {
  column: Column;
  cards: Card[];
  people: Person[];
  tags: Tag[];
  canDrag: boolean;
  onOpenCard: (id: string) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const element = targetRef.current;
    if (!element || !canDrag) return;
    return dropTargetForElements({
      element,
      getData: () => ({ type: "column", columnId: column.id }),
      canDrop: ({ source }) => source.data.type === "card",
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    });
  }, [canDrag, column.id]);

  return (
    <section
      className="w-[286px] shrink-0"
      aria-labelledby={`column-${column.id}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              column.color === "pumpkin" && "bg-orange-500",
              column.color === "purple" && "bg-violet-500",
              column.color === "green" && "bg-emerald-500",
              column.color === "berry" && "bg-rose-500",
              column.color === "neutral" && "bg-stone-400",
            )}
          />
          <h2
            id={`column-${column.id}`}
            className="text-xs font-bold uppercase tracking-[0.08em]"
          >
            {column.name}
          </h2>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </div>
      <div
        ref={targetRef}
        data-column-id={column.id}
        className={cn(
          "min-h-24 space-y-3 rounded-2xl bg-[#ebe6de]/70 p-2.5 transition-shadow",
          over && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            columnId={column.id}
            people={people}
            tags={tags}
            canDrag={canDrag}
            onOpen={() => onOpenCard(card.id)}
          />
        ))}
        {!cards.length ? (
          <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-[#cec5b9] px-4 text-center text-xs leading-5 text-muted-foreground">
            Nothing here right now
          </div>
        ) : null}
      </div>
    </section>
  );
}
