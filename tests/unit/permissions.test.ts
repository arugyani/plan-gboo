import { describe, expect, it } from "vitest";
import {
  canEditGroup,
  canOrganizeGroup,
  canViewGroup,
} from "@/lib/permissions";
import type { Person } from "@/lib/types";

const person = (
  role?: "organizer" | "member" | "view_only",
  admin = false,
): Person => ({
  id: "person",
  name: "Person",
  email: "person@example.test",
  systemRole: admin ? "admin" : "member",
  active: true,
  groupRoles: role ? { group: role } : {},
});

describe("group permissions", () => {
  it("keeps view-only people read-only", () => {
    expect(canViewGroup(person("view_only"), "group")).toBe(true);
    expect(canEditGroup(person("view_only"), "group")).toBe(false);
    expect(canOrganizeGroup(person("view_only"), "group")).toBe(false);
  });

  it("lets members change cards but not organize the group", () => {
    expect(canEditGroup(person("member"), "group")).toBe(true);
    expect(canOrganizeGroup(person("member"), "group")).toBe(false);
  });

  it("lets organizers manage their group and admins recover any group", () => {
    expect(canOrganizeGroup(person("organizer"), "group")).toBe(true);
    expect(canOrganizeGroup(person(undefined, true), "another-group")).toBe(
      true,
    );
  });
});
