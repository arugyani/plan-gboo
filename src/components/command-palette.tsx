import { useEffect, useRef, useState } from "react";
import { FileText, LayoutDashboard, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navigationItems, type View } from "@/lib/navigation";
import type { DashboardData } from "@/types";

export function CommandPalette({
  data,
  onView,
  onBoard,
  onPerson,
  onCard,
}: {
  data: DashboardData;
  onView: (view: View) => void;
  onBoard: (id: string) => void;
  onPerson: (id: string) => void;
  onCard: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pendingAction = useRef<(() => void) | null>(null);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.isComposing ||
        event.repeat
      )
        return;
      // Do not replace an in-progress card editor or another modal.
      if (!open && document.querySelector('[role="dialog"][data-state="open"]'))
        return;
      event.preventDefault();
      setQuery("");
      setOpen((value) => !value);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);
  const choose = (action: () => void) => {
    pendingAction.current = action;
    setOpen(false);
  };
  const matches = (text: string) =>
    text.toLowerCase().includes(query.trim().toLowerCase());
  const cards = data.cards.filter((card) =>
    matches(`${card.key} ${card.title}`),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setQuery("");
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 bg-background text-muted-foreground sm:w-64 sm:justify-start"
          aria-label="Search cards, boards, and people"
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Search className="size-4" />
          <span className="whitespace-nowrap">Search…</span>
          <kbd
            className="ml-auto hidden shrink-0 whitespace-nowrap rounded border border-border px-1.5 text-[10px] sm:inline"
            aria-hidden="true"
          >
            ⌘ / Ctrl K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="command-palette top-[15vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
        onCloseAutoFocus={() => {
          const action = pendingAction.current;
          pendingAction.current = null;
          // Let Radix restore trigger focus before opening the next dialog.
          if (action) window.setTimeout(action, 0);
        }}
      >
        <DialogTitle className="sr-only">Search RGBOO</DialogTitle>
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-3 border-b border-border px-4 pr-14">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <CommandInput
              autoFocus
              value={query}
              onValueChange={setQuery}
              aria-label="Search cards, boards, and people"
              placeholder="Search cards, boards, people…"
              className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList className="command-results overflow-y-auto overscroll-contain">
            <CommandEmpty className="px-5 py-10 text-center text-sm text-muted-foreground">
              No matches. Try another name or card ID.
            </CommandEmpty>
            <CommandGroup heading="Go to">
              {navigationItems
                .filter((item) => matches(item.label))
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`view-${item.id}`}
                    onSelect={() => choose(() => onView(item.id))}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="Boards">
              {data.boards
                .filter((board) => matches(board.name))
                .map((board) => (
                  <CommandItem
                    key={board.id}
                    value={`board-${board.id}`}
                    onSelect={() => choose(() => onBoard(board.id))}
                  >
                    <LayoutDashboard className="size-4 shrink-0" />
                    <span className="truncate">{board.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="People">
              {data.people
                .filter((person) => person.active && matches(person.name))
                .map((person) => (
                  <CommandItem
                    key={person.id}
                    value={`person-${person.id}`}
                    onSelect={() => choose(() => onPerson(person.id))}
                  >
                    <Users className="size-4 shrink-0" />
                    <span className="truncate">{person.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="Cards">
              {cards.slice(0, 30).map((card) => (
                <CommandItem
                  key={card.id}
                  value={`card-${card.id}`}
                  onSelect={() => choose(() => onCard(card.id))}
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {card.key}
                  </span>
                  <span className="truncate">{card.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {cards.length > 30 && (
              <p className="px-5 pb-3 text-xs text-muted-foreground">
                Showing 30 cards. Type to narrow your search.
              </p>
            )}
          </CommandList>
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            ↑ ↓ to navigate · Enter to open · Esc to close
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
