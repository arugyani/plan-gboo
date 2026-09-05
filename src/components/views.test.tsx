import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityView } from "@/components/activity-view";
import { AllTogetherView } from "@/components/all-together-view";
import { Navigation, SyncStatus, type View } from "@/components/app-navigation";
import { MyListView } from "@/components/my-list-view";
import { demoDashboard } from "@/test/dashboard-fixture";

describe("shared views", () => {
  it("navigates to the recent changes view", () => {
    let current: View = "board";
    const setView = vi.fn((next: View) => {
      current = next;
    });
    const { rerender } = render(
      <Navigation view={current} setView={setView} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "What’s Happening" }));
    expect(setView).toHaveBeenCalledWith("activity");
    rerender(<Navigation view={current} setView={setView} compact />);
    expect(
      screen.getByRole("button", { name: "What’s Happening" }),
    ).toHaveClass("bg-card");
  });

  it("shows sync progress without an extra refresh control", () => {
    const { rerender } = render(<SyncStatus syncing />);
    expect(screen.getByText("Syncing")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /refresh/i }),
    ).not.toBeInTheDocument();

    rerender(<SyncStatus syncing={false} />);
    expect(screen.getAllByText("Synced")).toHaveLength(2);
  });

  it("opens cards from My List and supports an empty list", () => {
    const openCard = vi.fn();
    const setSearch = vi.fn();
    const { rerender } = render(
      <MyListView
        data={demoDashboard}
        cards={[demoDashboard.cards[0]]}
        search=""
        setSearch={setSearch}
        onOpenCard={openCard}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Find in My List…"), {
      target: { value: "SHOW-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /show-12/i }));
    expect(setSearch).toHaveBeenCalledWith("SHOW-12");
    expect(openCard).toHaveBeenCalledWith("card-1");

    rerender(
      <MyListView
        data={demoDashboard}
        cards={[]}
        search=""
        setSearch={setSearch}
        onOpenCard={openCard}
      />,
    );
    expect(screen.getByText("Your list is clear")).toBeInTheDocument();
  });

  it("opens a card from the shared recent-change feed", () => {
    const openCard = vi.fn();
    const { rerender } = render(
      <ActivityView data={demoDashboard} onOpenCard={openCard} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show-12/i }));
    expect(openCard).toHaveBeenCalledWith("card-1");

    rerender(
      <ActivityView
        data={{ ...demoDashboard, activity: [] }}
        onOpenCard={openCard}
      />,
    );
    expect(screen.getByText("No changes yet")).toBeInTheDocument();
    expect(
      screen.getByText("Card updates from RGBOO and Discord will show here."),
    ).toBeInTheDocument();
  });

  it("combines selected boards without enabling card dragging", () => {
    const openCard = vi.fn();
    const toggleBoard = vi.fn();
    render(
      <AllTogetherView
        data={demoDashboard}
        selectedBoardIds={demoDashboard.boards.map((board) => board.id)}
        onToggleBoard={toggleBoard}
        cards={demoDashboard.cards}
        search=""
        setSearch={vi.fn()}
        mineOnly={false}
        setMineOnly={vi.fn()}
        importance="all"
        setImportance={vi.fn()}
        onOpenCard={openCard}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Opening Night" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Website Refresh" }),
    ).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /open show-12/i });
    expect(card.closest("[data-card-id]")).not.toHaveClass("cursor-grab");
    fireEvent.click(card);
    expect(openCard).toHaveBeenCalledWith("card-1");
    fireEvent.click(screen.getByRole("button", { name: "Opening Night" }));
    expect(toggleBoard).toHaveBeenCalledWith("opening-night");
  });
});
