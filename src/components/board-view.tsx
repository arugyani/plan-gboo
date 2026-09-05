import { useEffect } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import {
  announce,
  cleanup as cleanupLiveRegion,
} from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { MoonStar, Plus, Search, Users } from "lucide-react";
import { BoardColumn } from "@/components/board-column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Card, DashboardData, Importance } from "@/types";

export function BoardView({
  data,
  currentBoard,
  columns,
  cards,
  search,
  setSearch,
  mineOnly,
  setMineOnly,
  importance,
  setImportance,
  canCreate,
  busy,
  onCreate,
  onRecap,
  onOpenCard,
  onMoveCard,
}: {
  data: DashboardData;
  currentBoard: DashboardData["boards"][number];
  columns: DashboardData["columns"];
  cards: Card[];
  search: string;
  setSearch: (value: string) => void;
  mineOnly: boolean;
  setMineOnly: (value: boolean) => void;
  importance: Importance | "all";
  setImportance: (value: Importance | "all") => void;
  canCreate: boolean;
  busy: boolean;
  onCreate: () => void;
  onRecap: () => void;
  onOpenCard: (id: string) => void;
  onMoveCard: (
    cardId: string,
    columnId: string,
    placement?: { targetCardId: string; edge: "before" | "after" },
  ) => Promise<void>;
}) {
  useEffect(() => {
    if (!canCreate) return;
    const stop = monitorForElements({
      canMonitor: ({ source }) => source.data.type === "card",
      onDragStart: ({ source }) => {
        const card = cards.find((item) => item.id === source.data.cardId);
        if (card) announce(`Moving ${card.title}. Choose another column.`);
      },
      onDrop: ({ source, location }) => {
        const cardId = source.data.cardId;
        const target = location.current.dropTargets[0];
        const columnId = target?.data.columnId;
        if (typeof cardId !== "string" || typeof columnId !== "string") {
          announce("Move cancelled.");
          return;
        }
        const card = cards.find((item) => item.id === cardId);
        const column = columns.find((item) => item.id === columnId);
        if (!card || !column) {
          announce("Move cancelled.");
          return;
        }
        const targetCardId = target.data.cardId;
        const edge = target.data.edge;
        const placement:
          | {
              targetCardId: string;
              edge: "before" | "after";
            }
          | undefined =
          typeof targetCardId === "string" &&
          targetCardId !== cardId &&
          (edge === "before" || edge === "after")
            ? { targetCardId, edge }
            : undefined;
        if (card.columnId === columnId && !placement) {
          announce("Card stayed in the same column.");
          return;
        }
        void onMoveCard(cardId, columnId, placement)
          .then(() => announce(`${card.title} moved to ${column.name}.`))
          .catch(() => announce("The move failed and was rolled back."));
      },
    });
    return () => {
      stop();
      cleanupLiveRegion();
    };
  }, [canCreate, cards, columns, onMoveCard]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="border-b border-border bg-background/90 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {currentBoard.name}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRecap}>
              <MoonStar /> Recap
            </Button>
            {canCreate ? (
              <Button onClick={onCreate}>
                <Plus /> Add a card
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative block flex-1 md:hidden">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a card…"
              className="pl-9"
            />
          </div>
          <Button
            variant={mineOnly ? "secondary" : "outline"}
            onClick={() => setMineOnly(!mineOnly)}
          >
            <Users /> {mineOnly ? "Showing mine" : "Mine only"}
          </Button>
          <select
            aria-label="Filter by importance"
            value={importance}
            onChange={(event) =>
              setImportance(event.target.value as Importance | "all")
            }
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Any importance</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">No flag</option>
          </select>
          {mineOnly || importance !== "all" || search ? (
            <Button
              variant="ghost"
              onClick={() => {
                setMineOnly(false);
                setImportance("all");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="board-scroll flex gap-4 overflow-x-auto p-4 sm:p-6 lg:p-8"
        aria-label={`${currentBoard.name} columns`}
      >
        {columns.map((column) => {
          const columnCards = cards
            .filter((card) => card.columnId === column.id)
            .sort((a, b) => a.rank - b.rank);
          return (
            <BoardColumn
              key={column.id}
              column={column}
              cards={columnCards}
              people={data.people}
              tags={data.tags}
              canDrag={canCreate && !busy}
              onOpenCard={onOpenCard}
            />
          );
        })}
      </div>
    </div>
  );
}
