import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardSheet } from "@/components/card-sheet";
import { demoDashboard } from "@/test/dashboard-fixture";

function sheetProps(cardIndex = 3) {
  const card = structuredClone(demoDashboard.cards[cardIndex]);
  const board = demoDashboard.boards.find((item) => item.id === card.boardId)!;
  return {
    card,
    open: true,
    onOpenChange: vi.fn(),
    columns: demoDashboard.columns.filter(
      (column) => column.boardId === card.boardId,
    ),
    people: demoDashboard.people,
    tags: demoDashboard.tags.filter((tag) => tag.groupId === board.groupId),
    viewerId: demoDashboard.viewer.id,
    canEdit: true,
    busy: false,
    onSave: vi.fn(async () => undefined),
    onMove: vi.fn(async () => undefined),
    canMoveUp: true,
    canMoveDown: true,
    onReorder: vi.fn(async () => undefined),
    onAddComment: vi.fn(async () => undefined),
    onAddChecklistItem: vi.fn(async () => undefined),
    onSetChecklistItem: vi.fn(async () => undefined),
    onAddGitHubLink: vi.fn(async () => undefined),
    onRemoveGitHubLink: vi.fn(async () => undefined),
  };
}

describe("card details", () => {
  it("saves the editable fields with a version check", async () => {
    const props = sheetProps();
    render(<CardSheet {...props} />);

    fireEvent.change(screen.getByLabelText("Card title"), {
      target: { value: "Review the welcome copy" },
    });
    fireEvent.change(screen.getByPlaceholderText(/add context/i), {
      target: { value: "Read it on a phone first." },
    });
    fireEvent.change(screen.getByLabelText("Importance"), {
      target: { value: "urgent" },
    });
    fireEvent.click(screen.getByLabelText("Avery"));
    fireEvent.click(screen.getByLabelText("web"));
    fireEvent.change(screen.getByLabelText("New tag"), {
      target: { value: "discord" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Review the welcome copy",
        notes: "Read it on a phone first.",
        importance: "urgent",
        tagNames: ["discord"],
        expectedVersion: props.card.version,
      }),
    );
  });

  it("offers the same quick actions as Discord", () => {
    const props = sheetProps();
    render(<CardSheet {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Join this" }));
    expect(props.onSave).toHaveBeenCalledWith({
      personIds: [...props.card.personIds, demoDashboard.viewer.id],
      expectedVersion: props.card.version,
    });

    fireEvent.click(screen.getByRole("button", { name: "Waiting" }));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ blocked: true }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    expect(props.onMove).toHaveBeenCalledWith("web-4", props.card.version);
    fireEvent.change(screen.getByLabelText("Column"), {
      target: { value: "web-1" },
    });
    expect(props.onMove).toHaveBeenCalledWith("web-1", props.card.version);
    fireEvent.click(screen.getByRole("button", { name: "Move up" }));
    fireEvent.click(screen.getByRole("button", { name: "Move down" }));
    expect(props.onReorder).toHaveBeenCalledWith("up", props.card.version);
    expect(props.onReorder).toHaveBeenCalledWith("down", props.card.version);
  });

  it("adds notes, checklist items, and GitHub issue links", async () => {
    const props = sheetProps();
    render(<CardSheet {...props} />);

    fireEvent.click(screen.getByLabelText("Read it aloud"));
    expect(props.onSetChecklistItem).toHaveBeenCalledWith("check-3", false);

    fireEvent.change(screen.getByLabelText("New checklist item"), {
      target: { value: "Ask the stream team" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));
    await waitFor(() =>
      expect(props.onAddChecklistItem).toHaveBeenCalledWith(
        "Ask the stream team",
      ),
    );

    fireEvent.change(screen.getByLabelText("GitHub issue URL"), {
      target: { value: "https://github.com/rgboo/site/issues/12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link GitHub issue" }));
    await waitFor(() =>
      expect(props.onAddGitHubLink).toHaveBeenCalledWith(
        "https://github.com/rgboo/site/issues/12",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove issue link" }));
    expect(props.onRemoveGitHubLink).toHaveBeenCalledWith("link-1");

    fireEvent.change(screen.getByPlaceholderText("Add a note for everyone…"), {
      target: { value: "This is ready for another look." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(
        "This is ready for another look.",
      ),
    );
  });

  it("previews card notes as safe Markdown", async () => {
    const props = sheetProps();
    render(<CardSheet {...props} />);

    fireEvent.change(screen.getByLabelText("Card notes"), {
      target: { value: "## Before opening\n\n- [x] Check the lights" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    const heading = await screen.findByRole("heading", {
      name: "Before opening",
    });
    expect(heading).toBeInTheDocument();
    expect(
      within(heading.closest("section")!).getByRole("checkbox"),
    ).toBeChecked();
  });

  it("stays read-only for viewers", () => {
    const props = sheetProps(0);
    render(<CardSheet {...props} canEdit={false} />);
    expect(screen.getByLabelText("Card title")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GitHub issue URL")).not.toBeInTheDocument();
  });

  it("shows the card's durable change history", () => {
    const props = sheetProps(0);
    render(<CardSheet {...props} />);

    expect(screen.getByText("What Changed")).toBeInTheDocument();
    expect(
      screen.getByText("A note was added to Map the full run-through."),
    ).toBeInTheDocument();
  });
});
