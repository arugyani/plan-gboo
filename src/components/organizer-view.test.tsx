import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupsView } from "@/components/organizer-view";
import { PeopleView } from "@/components/people-view";
import { demoDashboard } from "@/test/dashboard-fixture";

function organizerProps() {
  return {
    data: structuredClone(demoDashboard),
    busy: false,
    onCreateGroup: vi.fn(async () => undefined),
    onUpdateGroup: vi.fn(async () => undefined),
    onSetRole: vi.fn(async () => undefined),
    onRemovePerson: vi.fn(async () => undefined),
    onCreateBoard: vi.fn(async () => undefined),
    onUpdateBoard: vi.fn(async () => undefined),
    onDeleteBoard: vi.fn(async () => undefined),
    onDeleteGroup: vi.fn(async () => undefined),
  };
}

describe("organizer screens", () => {
  it("creates groups and boards with the selected theme", async () => {
    const props = organizerProps();
    render(<GroupsView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Add group" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Lantern Crew" },
    });
    fireEvent.change(screen.getAllByLabelText("Icon")[1], {
      target: { value: "pumpkin" },
    });
    fireEvent.change(screen.getAllByLabelText("Accent")[1], {
      target: { value: "green" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));
    await waitFor(() =>
      expect(props.onCreateGroup).toHaveBeenCalledWith({
        name: "Lantern Crew",
        icon: "pumpkin",
        accent: "green",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add board" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Costumes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add board" }));
    await waitFor(() =>
      expect(props.onCreateBoard).toHaveBeenCalledWith({
        name: "Costumes",
        groupId: "show-crew",
      }),
    );
  });

  it("updates a group theme and its people", () => {
    const props = organizerProps();
    render(<GroupsView {...props} />);

    fireEvent.change(screen.getByLabelText("Icon"), {
      target: { value: "bat" },
    });
    fireEvent.change(screen.getByLabelText("Accent"), {
      target: { value: "berry" },
    });
    expect(props.onUpdateGroup).toHaveBeenCalledWith("show-crew", {
      icon: "bat",
    });
    expect(props.onUpdateGroup).toHaveBeenCalledWith("show-crew", {
      accent: "berry",
    });

    fireEvent.change(screen.getByLabelText("Role for Maya"), {
      target: { value: "view_only" },
    });
    expect(props.onSetRole).toHaveBeenCalledWith(
      "show-crew",
      "maya",
      "view_only",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Maya from Show Crew" }),
    );
    expect(props.onRemovePerson).toHaveBeenCalledWith("show-crew", "maya");

    fireEvent.change(screen.getByLabelText("Person to add"), {
      target: { value: "sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(props.onSetRole).toHaveBeenCalledWith("show-crew", "sam", "member");
  });

  it("keeps group creation global while allowing group organizers to manage their group", () => {
    const props = organizerProps();
    props.data.viewer.systemRole = "member";
    props.data.people[0].systemRole = "member";
    render(<GroupsView {...props} />);

    expect(
      screen.queryByRole("button", { name: "Add group" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Icon")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Add board" }),
    ).toBeInTheDocument();
  });

  it("renames and deletes boards only after confirmation", () => {
    const props = organizerProps();
    vi.spyOn(window, "prompt").mockReturnValue("Final Night");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<GroupsView {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Rename Opening Night" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Opening Night" }),
    );
    expect(props.onUpdateBoard).toHaveBeenCalledWith("opening-night", {
      name: "Final Night",
    });
    expect(props.onDeleteBoard).toHaveBeenCalledWith("opening-night");
  });

  it("renames and reorders a board's columns", async () => {
    const props = organizerProps();
    render(<GroupsView {...props} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Configure columns for Opening Night",
      }),
    );
    fireEvent.change(screen.getByLabelText("Column 1 name"), {
      target: { value: "Someday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move Done up" }));
    fireEvent.click(screen.getByRole("button", { name: "Save columns" }));

    await waitFor(() =>
      expect(props.onUpdateBoard).toHaveBeenCalledWith("opening-night", {
        columns: [
          expect.objectContaining({ name: "Someday", rank: 1024 }),
          expect.objectContaining({ name: "Up Next", rank: 2048 }),
          expect.objectContaining({ name: "Doing", rank: 3072 }),
          expect.objectContaining({ name: "Done", rank: 4096 }),
          expect.objectContaining({ name: "Waiting", rank: 5120 }),
        ],
      }),
    );
  });

  it("lists active people, group roles, and sign out", () => {
    const signOut = vi.fn(async () => undefined);
    render(<PeopleView data={demoDashboard} onSignOut={signOut} />);
    expect(screen.getByText("Avery (you)")).toBeInTheDocument();
    expect(screen.getByText("Show Crew · Organizer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
