import { CalendarDays, Ghost, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatShortDate } from "@/lib/utils";
import type { Card, DashboardData } from "@/types";

export function MyListView({
  data,
  cards,
  search,
  setSearch,
  onOpenCard,
}: {
  data: DashboardData;
  cards: Card[];
  search: string;
  setSearch: (value: string) => void;
  onOpenCard: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <h1 className="text-3xl font-bold tracking-tight">My List</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find in My List…"
            className="pl-9"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {cards.map((card) => {
          const board = data.boards.find((item) => item.id === card.boardId);
          const column = data.columns.find((item) => item.id === card.columnId);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenCard(card.id)}
              className="grid w-full gap-3 border-b border-border px-4 py-4 text-left last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_140px_100px] sm:items-center"
            >
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground">
                    {card.key}
                  </span>
                  {card.blocked ? (
                    <Badge variant="danger">Waiting</Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm font-semibold">{card.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {board?.name}
                </p>
              </div>
              <Badge variant="neutral" className="w-fit">
                {column?.name}
              </Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {formatShortDate(card.when)}
              </span>
            </button>
          );
        })}
        {!cards.length ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <Ghost className="mx-auto mb-3 size-8 text-orange-500" />
              <p className="font-semibold">Your list is clear</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Join a card when you want it to show up here.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
