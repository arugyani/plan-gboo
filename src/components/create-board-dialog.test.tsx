import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateBoardDialog } from "./create-board-dialog";
import { demoDashboard } from "@/test/dashboard-fixture";

describe("create board", () => {
  it("validates the name and submits the chosen group", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CreateBoardDialog
        groups={demoDashboard.groups}
        busy={false}
        onCreate={onCreate}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("button", { name: "Add board" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Board name"), {
      target: { value: "  October  " },
    });
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: demoDashboard.groups[1].id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add board" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith({
      name: "October",
      groupId: demoDashboard.groups[1].id,
    });
  });
  it("retains input when saving fails", async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error("A board with that name already exists."));
    const onClose = vi.fn();
    render(
      <CreateBoardDialog
        groups={demoDashboard.groups}
        busy={false}
        onCreate={onCreate}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText("Board name"), {
      target: { value: "October" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add board" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    expect(screen.getByLabelText("Board name")).toHaveValue("October");
    expect(onClose).not.toHaveBeenCalled();
  });
});
