import { useEffect, useState } from "react";
import { navigationItems, type View } from "@/lib/navigation";
export type { View } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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
  return (
    <nav
      aria-label="Primary"
      className={
        compact ? "board-scroll flex gap-1 overflow-x-auto" : "space-y-1"
      }
    >
      {navigationItems.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={view === item.id ? "page" : undefined}
          onClick={() => setView(item.id)}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
            compact ? "min-w-max flex-1 gap-1.5 px-2 text-[11px]" : "w-full",
            view === item.id && "bg-card text-foreground shadow-sm",
          )}
        >
          <item.icon className="size-4" /> {item.label}
        </button>
      ))}
    </nav>
  );
}
