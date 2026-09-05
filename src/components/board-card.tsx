import { useEffect, useRef, useState } from "react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/utils/combine";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatShortDate } from "@/lib/utils";
import type { Card, Person, Tag } from "@/types";

const importanceLabel = {
  none: null,
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

export function BoardCard({
  card,
  columnId,
  people,
  tags,
  onOpen,
  canDrag = false,
}: {
  card: Card;
  columnId: string;
  people: Person[];
  tags: Tag[];
  onOpen: () => void;
  canDrag?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<"before" | "after" | null>(null);
  const assigned = people.filter((person) =>
    card.personIds.includes(person.id),
  );
  const cardTags = tags.filter((tag) => card.tagIds.includes(tag.id));
  const completed = card.checklist.filter((item) => item.complete).length;
  const importance = importanceLabel[card.importance];

  useEffect(() => {
    const element = cardRef.current;
    if (!element || !canDrag) return;
    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: "card", cardId: card.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.type === "card" && source.data.cardId !== card.id,
        getData: ({ input, element: target }) => ({
          type: "card-target",
          cardId: card.id,
          columnId,
          edge:
            input.clientY <
            target.getBoundingClientRect().top +
              target.getBoundingClientRect().height / 2
              ? "before"
              : "after",
        }),
        onDrag: ({ self }) =>
          setEdge(self.data.edge === "before" ? "before" : "after"),
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [canDrag, card.id, columnId]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative",
        canDrag && "cursor-grab active:cursor-grabbing",
        edge === "before" &&
          "before:absolute before:-top-2 before:left-2 before:right-2 before:h-0.5 before:rounded-full before:bg-primary",
        edge === "after" &&
          "after:absolute after:-bottom-2 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary",
      )}
      data-card-id={card.id}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group w-full rounded-xl border border-border bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(43,34,24,0.05)] transition hover:-translate-y-px hover:border-[#c6b9a8] hover:shadow-[0_5px_16px_rgba(43,34,24,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging && "opacity-55",
        )}
        aria-label={`Open ${card.key}: ${card.title}`}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground">
            {card.key}
          </span>
          {card.blocked ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700">
              <CircleAlert className="size-3" /> Waiting
            </span>
          ) : importance ? (
            <span
              className={cn(
                "size-2 rounded-full",
                card.importance === "urgent" && "bg-red-500",
                card.importance === "high" && "bg-orange-500",
                card.importance === "medium" && "bg-violet-500",
                card.importance === "low" && "bg-emerald-500",
              )}
              title={`${importance} importance`}
            />
          ) : null}
        </div>
        <h3 className="text-sm font-semibold leading-5 text-card-foreground">
          {card.title}
        </h3>
        {cardTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cardTags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                variant={tag.color === "green" ? "green" : "purple"}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex min-h-7 items-center justify-between gap-3 text-muted-foreground">
          <div className="flex items-center gap-2 text-[11px]">
            {card.when ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />{" "}
                {formatShortDate(card.when)}
              </span>
            ) : null}
            {card.checklist.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                {completed === card.checklist.length ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                ) : (
                  <ListChecks className="size-3.5" />
                )}
                {completed}/{card.checklist.length}
              </span>
            ) : null}
            {card.comments.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" /> {card.comments.length}
              </span>
            ) : null}
          </div>
          <div className="flex -space-x-2">
            {assigned.slice(0, 3).map((person) => (
              <Avatar key={person.id} name={person.name} src={person.image} />
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}
