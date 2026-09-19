import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoveBoardDialog } from "./move-board-dialog";
import { demoDashboard } from "@/test/dashboard-fixture";

describe("move to board", () => {
  it("submits the destination column and original version only on confirmation", async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <MoveBoardDialog
        card={demoDashboard.cards[0]}
        boards={demoDashboard.boards}
        columns={demoDashboard.columns}
        busy={false}
        onMove={onMove}
        onClose={onClose}
      />,
    );
    const destination = demoDashboard.boards[1];
    fireEvent.change(screen.getByLabelText("Destination board"), {
      target: { value: destination.id },
    });
    const column = demoDashboard.columns.find(
      (column) => column.boardId === destination.id,
    )!;
    expect(screen.getByLabelText("Destination column")).toHaveValue(column.id);
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Move card" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onMove).toHaveBeenCalledWith(
      destination.id,
      column.id,
      demoDashboard.cards[0].version,
    );
  });
  it("keeps the dialog open after a conflict and does not silently adopt a newer version", async () => {
    const card = demoDashboard.cards[0];
    const onMove = vi
      .fn()
      .mockRejectedValue(
        new Error("This card changed while you were looking at it."),
      );
    const props = {
      card,
      boards: demoDashboard.boards,
      columns: demoDashboard.columns,
      busy: false,
      onMove,
      onClose: vi.fn(),
    };
    const { rerender } = render(<MoveBoardDialog {...props} />);
    rerender(
      <MoveBoardDialog
        {...props}
        card={{ ...card, version: card.version + 1 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move card" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This card changed",
    );
    expect(onMove.mock.calls[0][2]).toBe(card.version);
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
