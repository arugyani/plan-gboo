import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ghost } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { AllTogetherView } from "@/components/all-together-view";
import { toast } from "sonner";
import { ActivityView } from "@/components/activity-view";
import { Navigation, SyncStatus, type View } from "@/components/app-navigation";
import { BoardView } from "@/components/board-view";
import { CardSheet } from "@/components/card-sheet";
import { CreateCardDialog } from "@/components/create-card-dialog";
import { MyListView } from "@/components/my-list-view";
import { GroupsView } from "@/components/organizer-view";
import { PeopleView } from "@/components/people-view";
import { RecapDialog } from "@/components/recap-dialog";
import {
  EmptyWorkspace,
  ErrorScreen,
  LoadingScreen,
} from "@/components/state-screens";
import { boardApi } from "@/lib/board-api";
import { cn } from "@/lib/utils";
import type {
  Card,
  CardPatch,
  CreateCardInput,
  DashboardData,
  Importance,
} from "@/types";

type CardPlacement = { targetCardId: string; edge: "before" | "after" };

function rankForPlacement(
  cards: Card[],
  movingId: string,
  columnId: string,
  placement?: CardPlacement,
) {
  const ordered = cards
    .filter((card) => card.id !== movingId && card.columnId === columnId)
    .sort((left, right) => left.rank - right.rank);
  if (!placement) return (ordered.at(-1)?.rank ?? 0) + 1024;
  const targetIndex = ordered.findIndex(
    (card) => card.id === placement.targetCardId,
  );
  if (targetIndex < 0) return (ordered.at(-1)?.rank ?? 0) + 1024;
  const insertionIndex =
    placement.edge === "after" ? targetIndex + 1 : targetIndex;
  const previous = ordered[insertionIndex - 1]?.rank;
  const next = ordered[insertionIndex]?.rank;
  if (previous === undefined) return (next ?? 1024) - 1024;
  if (next === undefined) return previous + 1024;
  return previous + (next - previous) / 2;
}

function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("together");
  const [personId, setPersonId] = useState("all");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [importance, setImportance] = useState<Importance | "all">("all");
  const [togetherBoardIds, setTogetherBoardIds] = useState<string[] | null>(
    null,
  );

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => boardApi.dashboard(),
    refetchInterval: 30_000,
  });

  const syncCard = (card: Card) => {
    queryClient.setQueryData<DashboardData>(["dashboard"], (current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((item) =>
              item.id === card.id ? card : item,
            ),
          }
        : current,
    );
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const createCard = useMutation({
    mutationFn: (input: CreateCardInput) => boardApi.createCard(input),
    onSuccess: async (card) => {
      await refresh();
      setSelectedCardId(card.id);
      toast.success(`${card.key} joined the board`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateCard = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardPatch }) =>
      boardApi.updateCard(id, patch),
    onSuccess: async (card) => {
      syncCard(card);
      await refresh();
      toast.success("Card saved");
    },
    onError: async (error: Error) => {
      toast.error(error.message);
      await refresh();
    },
  });

  const moveCard = useMutation({
    mutationFn: ({
      id,
      columnId,
      version,
      placement,
    }: {
      id: string;
      columnId: string;
      version: number;
      placement?: CardPlacement;
    }) => boardApi.moveCard(id, columnId, version, placement),
    onMutate: async ({ id, columnId, placement }) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard"] });
      const previous = queryClient.getQueryData<DashboardData>(["dashboard"]);
      queryClient.setQueryData<DashboardData>(["dashboard"], (current) =>
        current
          ? {
              ...current,
              cards: current.cards.map((card) =>
                card.id === id
                  ? {
                      ...card,
                      columnId,
                      rank: rankForPlacement(
                        current.cards,
                        id,
                        columnId,
                        placement,
                      ),
                      version: card.version + 1,
                      updatedAt: new Date().toISOString(),
                    }
                  : card,
              ),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: (card) => {
      syncCard(card);
      toast.success("Card moved");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous)
        queryClient.setQueryData(["dashboard"], context.previous);
      toast.error(error.message);
    },
    onSettled: refresh,
  });

  const detailMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const organizerMutation = useMutation({
    mutationFn: ({
      action,
    }: {
      action: () => Promise<unknown>;
      success: string;
    }) => action(),
    onSuccess: async (_result, variables) => {
      await refresh();
      toast.success(variables.success);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const organize = async (action: () => Promise<unknown>, success: string) => {
    await organizerMutation.mutateAsync({ action, success });
  };

  if (dashboard.isLoading) return <LoadingScreen />;
  if (dashboard.error || !dashboard.data) {
    return (
      <ErrorScreen
        error={dashboard.error}
        onRetry={() => dashboard.refetch()}
      />
    );
  }

  const data = dashboard.data;
  const currentBoard =
    data.boards.find((board) => board.id === boardId) ?? data.boards[0] ?? null;
  if (!currentBoard) return <EmptyWorkspace />;
  const currentColumns = data.columns
    .filter((column) => column.boardId === currentBoard.id)
    .sort((a, b) => a.rank - b.rank);
  const selectedCard =
    data.cards.find((card) => card.id === selectedCardId) ?? null;
  const selectedBoard = selectedCard
    ? data.boards.find((board) => board.id === selectedCard.boardId)
    : currentBoard;
  const selectedColumns = selectedBoard
    ? data.columns
        .filter((column) => column.boardId === selectedBoard.id)
        .sort((a, b) => a.rank - b.rank)
    : [];
  const selectedTags = selectedBoard
    ? data.tags.filter(
        (tag) =>
          tag.groupId ===
          data.boards.find((board) => board.id === selectedBoard.id)?.groupId,
      )
    : [];
  const selectedGroupRole = selectedBoard
    ? data.viewer.groupRoles[selectedBoard.groupId]
    : undefined;
  const canEditSelected =
    data.viewer.systemRole === "admin" ||
    selectedGroupRole === "organizer" ||
    selectedGroupRole === "member";
  const boardRole = data.viewer.groupRoles[currentBoard.groupId];
  const canCreate =
    data.viewer.systemRole === "admin" ||
    boardRole === "organizer" ||
    boardRole === "member";

  const normalizedSearch = search.trim().toLowerCase();
  const boardCards = data.cards
    .filter((card) => card.boardId === currentBoard.id)
    .filter((card) => !mineOnly || card.personIds.includes(data.viewer.id))
    .filter((card) => importance === "all" || card.importance === importance)
    .filter(
      (card) =>
        !normalizedSearch ||
        card.title.toLowerCase().includes(normalizedSearch) ||
        card.key.toLowerCase().includes(normalizedSearch),
    );

  const myCards = data.cards
    .filter((card) => card.personIds.includes(data.viewer.id))
    .filter(
      (card) =>
        !normalizedSearch ||
        card.title.toLowerCase().includes(normalizedSearch) ||
        card.key.toLowerCase().includes(normalizedSearch),
    );
  const selectedTogetherBoardIds =
    togetherBoardIds ?? data.boards.map((board) => board.id);
  const togetherCards = data.cards
    .filter((card) => selectedTogetherBoardIds.includes(card.boardId))
    .filter(
      (card) =>
        personId === "all" ||
        (personId === "unassigned"
          ? card.personIds.length === 0
          : card.personIds.includes(personId)),
    )
    .filter((card) => !mineOnly || card.personIds.includes(data.viewer.id))
    .filter((card) => importance === "all" || card.importance === importance)
    .filter(
      (card) =>
        !normalizedSearch ||
        card.title.toLowerCase().includes(normalizedSearch) ||
        card.key.toLowerCase().includes(normalizedSearch),
    );

  const busy =
    createCard.isPending ||
    updateCard.isPending ||
    moveCard.isPending ||
    detailMutation.isPending ||
    organizerMutation.isPending;

  const selectBoard = (nextId: string) => {
    setBoardId(nextId);
    setView("board");
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#29231f] text-[#f5a36f]">
            <Ghost className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">RGBOO</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 pl-3 sm:gap-5">
          <CommandPalette
            data={data}
            onView={setView}
            onBoard={selectBoard}
            onCard={setSelectedCardId}
            onPerson={(id) => {
              setPersonId(id);
              setTogetherBoardIds(null);
              setSearch("");
              setMineOnly(false);
              setImportance("all");
              setView("together");
            }}
          />
          <SyncStatus syncing={dashboard.isFetching} />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-[#f1ede6] px-3 py-5 lg:block">
          <Navigation view={view} setView={setView} />
          <div className="mt-7">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Boards
            </p>
            <div className="space-y-1">
              {data.boards.map((board) => {
                const group = data.groups.find(
                  (item) => item.id === board.groupId,
                );
                return (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => selectBoard(board.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-card",
                      view === "board" &&
                        currentBoard.id === board.id &&
                        "bg-card font-semibold shadow-sm",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        group?.accent === "pumpkin" && "bg-orange-500",
                        group?.accent === "purple" && "bg-violet-500",
                        group?.accent === "green" && "bg-emerald-500",
                        group?.accent === "berry" && "bg-rose-500",
                      )}
                    />
                    <span className="truncate">{board.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="space-y-2 border-b border-border bg-card px-4 py-3 lg:hidden">
            <Navigation view={view} setView={setView} compact />
            {view === "board" || view === "together" ? (
              <select
                aria-label="Choose board view"
                value={view === "together" ? "all-together" : currentBoard.id}
                onChange={(event) => {
                  if (event.target.value === "all-together")
                    setView("together");
                  else selectBoard(event.target.value);
                }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="all-together">All Together</option>
                {data.boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {view === "board" ? (
            <BoardView
              data={data}
              currentBoard={currentBoard}
              columns={currentColumns}
              cards={boardCards}
              search={search}
              setSearch={setSearch}
              mineOnly={mineOnly}
              setMineOnly={setMineOnly}
              importance={importance}
              setImportance={setImportance}
              canCreate={canCreate}
              busy={busy}
              onCreate={() => setCreateOpen(true)}
              onRecap={() => setRecapOpen(true)}
              onOpenCard={setSelectedCardId}
              onMoveCard={async (cardId, columnId, placement) => {
                const card = data.cards.find((item) => item.id === cardId);
                if (!card) return;
                await moveCard.mutateAsync({
                  id: card.id,
                  columnId,
                  version: card.version,
                  placement,
                });
              }}
            />
          ) : view === "together" ? (
            <AllTogetherView
              data={data}
              personId={personId}
              setPersonId={(id) => {
                setPersonId(id);
                setMineOnly(false);
              }}
              onOpenBoard={selectBoard}
              selectedBoardIds={selectedTogetherBoardIds}
              onToggleBoard={(nextBoardId) =>
                setTogetherBoardIds((current) => {
                  const selected =
                    current ?? data.boards.map((board) => board.id);
                  return selected.includes(nextBoardId)
                    ? selected.filter((id) => id !== nextBoardId)
                    : [...selected, nextBoardId];
                })
              }
              cards={togetherCards}
              search={search}
              setSearch={setSearch}
              mineOnly={mineOnly}
              setMineOnly={setMineOnly}
              importance={importance}
              setImportance={setImportance}
              onOpenCard={setSelectedCardId}
            />
          ) : view === "mine" ? (
            <MyListView
              data={data}
              cards={myCards}
              search={search}
              setSearch={setSearch}
              onOpenCard={setSelectedCardId}
            />
          ) : view === "activity" ? (
            <ActivityView data={data} onOpenCard={setSelectedCardId} />
          ) : view === "groups" ? (
            <GroupsView
              data={data}
              busy={busy}
              onCreateGroup={(input) =>
                organize(() => boardApi.createGroup(input), "Group added")
              }
              onUpdateGroup={(groupId, input) =>
                organize(
                  () => boardApi.updateGroup(groupId, input),
                  "Group saved",
                )
              }
              onSetRole={(groupId, personId, role) =>
                organize(
                  () => boardApi.setGroupMember(groupId, personId, role),
                  "Group access saved",
                )
              }
              onRemovePerson={(groupId, personId) =>
                organize(
                  () => boardApi.removeGroupMember(groupId, personId),
                  "Person removed",
                )
              }
              onCreateBoard={(input) =>
                organize(() => boardApi.createBoard(input), "Board added")
              }
              onUpdateBoard={(nextBoardId, input) =>
                organize(
                  () => boardApi.updateBoard(nextBoardId, input),
                  input.columns ? "Columns saved" : "Board renamed",
                )
              }
              onDeleteBoard={(nextBoardId) =>
                organize(
                  () => boardApi.deleteBoard(nextBoardId),
                  "Board deleted",
                )
              }
              onDeleteGroup={(groupId) =>
                organize(() => boardApi.deleteGroup(groupId), "Group deleted")
              }
            />
          ) : (
            <PeopleView
              data={data}
              onSignOut={
                import.meta.env.PROD
                  ? async () => {
                      await boardApi.signOut();
                      window.location.reload();
                    }
                  : undefined
              }
            />
          )}
        </main>
      </div>

      <CreateCardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        board={currentBoard}
        columns={currentColumns}
        people={data.people.filter((person) =>
          Boolean(person.groupRoles[currentBoard.groupId]),
        )}
        busy={createCard.isPending}
        onCreate={async (input) => {
          await createCard.mutateAsync(input);
        }}
      />

      <RecapDialog
        open={recapOpen}
        onOpenChange={setRecapOpen}
        board={currentBoard}
        columns={currentColumns}
        cards={data.cards.filter((card) => card.boardId === currentBoard.id)}
      />

      <CardSheet
        card={selectedCard}
        open={Boolean(selectedCard)}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
        columns={selectedColumns}
        people={data.people.filter((person) =>
          selectedBoard
            ? Boolean(person.groupRoles[selectedBoard.groupId])
            : false,
        )}
        tags={selectedTags}
        viewerId={data.viewer.id}
        canEdit={canEditSelected}
        busy={busy}
        onSave={async (patch) => {
          if (!selectedCard) return;
          await updateCard.mutateAsync({ id: selectedCard.id, patch });
        }}
        onMove={async (columnId, version) => {
          if (!selectedCard) return;
          await moveCard.mutateAsync({
            id: selectedCard.id,
            columnId,
            version,
          });
        }}
        canMoveUp={
          selectedCard
            ? data.cards
                .filter(
                  (card) =>
                    card.columnId === selectedCard.columnId &&
                    card.boardId === selectedCard.boardId,
                )
                .sort((left, right) => left.rank - right.rank)
                .findIndex((card) => card.id === selectedCard.id) > 0
            : false
        }
        canMoveDown={
          selectedCard
            ? (() => {
                const cards = data.cards
                  .filter(
                    (card) =>
                      card.columnId === selectedCard.columnId &&
                      card.boardId === selectedCard.boardId,
                  )
                  .sort((left, right) => left.rank - right.rank);
                const index = cards.findIndex(
                  (card) => card.id === selectedCard.id,
                );
                return index >= 0 && index < cards.length - 1;
              })()
            : false
        }
        onReorder={async (direction, version) => {
          if (!selectedCard) return;
          const cards = data.cards
            .filter(
              (card) =>
                card.columnId === selectedCard.columnId &&
                card.boardId === selectedCard.boardId,
            )
            .sort((left, right) => left.rank - right.rank);
          const index = cards.findIndex((card) => card.id === selectedCard.id);
          const target = cards[index + (direction === "up" ? -1 : 1)];
          if (!target) return;
          await moveCard.mutateAsync({
            id: selectedCard.id,
            columnId: selectedCard.columnId,
            version,
            placement: {
              targetCardId: target.id,
              edge: direction === "up" ? "before" : "after",
            },
          });
        }}
        onAddComment={async (body) => {
          if (!selectedCard) return;
          await detailMutation.mutateAsync(() =>
            boardApi.addComment(selectedCard.id, body),
          );
        }}
        onAddChecklistItem={async (text) => {
          if (!selectedCard) return;
          await detailMutation.mutateAsync(() =>
            boardApi.addChecklistItem(selectedCard.id, text),
          );
        }}
        onSetChecklistItem={async (itemId, complete) => {
          if (!selectedCard) return;
          await detailMutation.mutateAsync(() =>
            boardApi.setChecklistItem(selectedCard.id, itemId, complete),
          );
        }}
        onAddGitHubLink={async (url) => {
          if (!selectedCard) return;
          await detailMutation.mutateAsync(() =>
            boardApi.addGitHubLink(selectedCard.id, url),
          );
        }}
        onRemoveGitHubLink={async (linkId) => {
          if (!selectedCard) return;
          await detailMutation.mutateAsync(() =>
            boardApi.removeGitHubLink(selectedCard.id, linkId),
          );
        }}
      />
    </div>
  );
}

export default App;
