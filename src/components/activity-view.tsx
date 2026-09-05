import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/utils";
import type { DashboardData } from "@/types";

export function ActivityView({
  data,
  onOpenCard,
}: {
  data: DashboardData;
  onOpenCard: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
      <h1 className="text-3xl font-bold tracking-tight">What’s Happening</h1>
      {data.activity.length ? (
        <ol className="mt-8 space-y-1">
          {data.activity.map((item) => {
            const actor = data.people.find(
              (person) => person.id === item.actorId,
            );
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => item.cardId && onOpenCard(item.cardId)}
                  disabled={!item.cardId}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-4 text-left hover:bg-card disabled:pointer-events-none"
                >
                  <Avatar
                    name={actor?.name ?? "The Board"}
                    src={actor?.image}
                    className="mt-0.5 size-8"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6">
                      <span className="font-semibold">
                        {actor?.name ?? "The Board"}
                      </span>{" "}
                      · {item.summary}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {relativeTime(item.createdAt)}
                    </p>
                  </div>
                  {item.cardId ? (
                    <ChevronRight className="mt-2 size-4 text-muted-foreground" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-8 grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-card/50 px-6 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">
              No changes yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Card updates from RGBOO and Discord will show here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
