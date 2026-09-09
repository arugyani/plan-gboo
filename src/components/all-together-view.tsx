import { useState } from "react";
import { Layers3, Search, Users } from "lucide-react";
import { BoardCard } from "@/components/board-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Card, DashboardData, Importance } from "@/types";

export function AllTogetherView({
  data,
  personId,
  setPersonId,
  onOpenBoard,
  selectedBoardIds,
  onToggleBoard,
  cards,
  search,
  setSearch,
  mineOnly,
  setMineOnly,
  importance,
  setImportance,
  onOpenCard,
}: {
  data: DashboardData;
  personId: string;
  setPersonId: (id: string) => void;
  onOpenBoard: (id: string) => void;
  selectedBoardIds: string[];
  onToggleBoard: (boardId: string) => void;
  cards: Card[];
  search: string;
  setSearch: (value: string) => void;
  mineOnly: boolean;
  setMineOnly: (value: boolean) => void;
  importance: Importance | "all";
  setImportance: (value: Importance | "all") => void;
  onOpenCard: (id: string) => void;
}) {
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(
    {},
  );
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <Layers3 className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            All Together
          </h1>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Boards to include
          </legend>
          <div className="flex flex-wrap gap-2">
            {data.boards.map((board) => (
              <Button
                key={board.id}
                type="button"
                size="sm"
                variant={
                  selectedBoardIds.includes(board.id) ? "secondary" : "outline"
                }
                aria-pressed={selectedBoardIds.includes(board.id)}
                onClick={() => onToggleBoard(board.id)}
              >
                {board.name}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Filter cards"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a card…"
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter by person"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            className="h-10 min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-44"
          >
            <option value="all">Everyone</option>
            <option value="unassigned">Nobody yet</option>
            {data.people
              .filter((person) => person.active)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
          </select>
          <Button
            variant={mineOnly ? "secondary" : "outline"}
            aria-pressed={mineOnly}
            className="h-10"
            onClick={() => {
              setPersonId("all");
              setMineOnly(!mineOnly);
            }}
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
        </div>

        {selectedBoardIds.length ? (
          <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
            {data.boards
              .filter((board) => selectedBoardIds.includes(board.id))
              .map((board) => {
                const boardCards = cards
                  .filter((card) => card.boardId === board.id)
                  .sort((left, right) =>
                    right.updatedAt.localeCompare(left.updatedAt),
                  );
                const visibleCount = visibleCounts[board.id] ?? 24;
                return (
                  <section
                    key={board.id}
                    className="rounded-2xl border border-border bg-[#ebe6de]/45 p-3"
                    aria-labelledby={`together-${board.id}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3 px-1">
                      <h2
                        id={`together-${board.id}`}
                        className="min-w-0 font-bold"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenBoard(board.id)}
                          className="max-w-full truncate rounded px-1 py-1 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Open board ${board.name}`}
                        >
                          {board.name}
                        </button>
                      </h2>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {boardCards.length}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {boardCards.slice(0, visibleCount).map((card) => (
                        <BoardCard
                          key={card.id}
                          card={card}
                          columnId={card.columnId}
                          people={data.people}
                          tags={data.tags}
                          onOpen={() => onOpenCard(card.id)}
                        />
                      ))}
                    </div>
                    {boardCards.length > visibleCount ? (
                      <Button
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() =>
                          setVisibleCounts((current) => ({
                            ...current,
                            [board.id]: visibleCount + 24,
                          }))
                        }
                        aria-label={`Show more cards from ${board.name}`}
                      >
                        Show more · {boardCards.length - visibleCount} remaining
                      </Button>
                    ) : null}
                    {!boardCards.length ? (
                      <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-[#cec5b9] text-sm text-muted-foreground">
                        Nothing matches here
                      </div>
                    ) : null}
                  </section>
                );
              })}
          </div>
        ) : (
          <div className="mt-7 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Choose at least one board to bring its cards into this view.
          </div>
        )}
      </div>
    </div>
  );
}
