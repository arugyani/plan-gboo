import { useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  ListTodo,
  UserRound,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type View =
  "board" | "together" | "mine" | "activity" | "groups" | "people";

export function SyncStatus({ syncing }: { syncing: boolean }) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!syncing) return;
    const interval = window.setInterval(
      () => setDotCount((current) => (current % 3) + 1),
      400,
    );
    return () => window.clearInterval(interval);
  }, [syncing]);

  return (
    <span className="inline-block min-w-14 text-right text-xs text-muted-foreground">
      <span aria-hidden="true">
        {syncing ? `Syncing${".".repeat(dotCount)}` : "Synced"}
      </span>
      <span className="sr-only" aria-live="polite">
        {syncing ? "Syncing" : "Synced"}
      </span>
    </span>
  );
}

export function Navigation({
  view,
  setView,
  compact = false,
}: {
  view: View;
  setView: (view: View) => void;
  compact?: boolean;
}) {
  const items = [
    { id: "mine" as const, label: "My List", icon: ListTodo },
    { id: "board" as const, label: "Boards", icon: LayoutDashboard },
    { id: "activity" as const, label: "What’s Happening", icon: Activity },
    { id: "groups" as const, label: "Groups", icon: UsersRound },
    { id: "people" as const, label: "People", icon: UserRound },
  ];

  return (
    <nav
      aria-label="Primary"
      className={
        compact ? "board-scroll flex gap-1 overflow-x-auto" : "space-y-1"
      }
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setView(item.id)}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
            compact ? "min-w-max flex-1 gap-1.5 px-2 text-[11px]" : "w-full",
            (view === item.id ||
              (item.id === "board" && view === "together")) &&
              "bg-card text-foreground shadow-sm",
          )}
        >
          <item.icon className="size-4" /> {item.label}
        </button>
      ))}
    </nav>
  );
}
