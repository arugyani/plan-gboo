import type { GroupRole, Person } from "./types";

const roleWeight: Record<GroupRole, number> = {
  view_only: 1,
  member: 2,
  organizer: 3,
};

export function hasGroupRole(
  person: Person,
  groupId: string,
  minimum: GroupRole,
) {
  if (person.systemRole === "admin") return true;
  const role = person.groupRoles[groupId];
  return role ? roleWeight[role] >= roleWeight[minimum] : false;
}

export function canViewGroup(person: Person, groupId: string) {
  return hasGroupRole(person, groupId, "view_only");
}

export function canEditGroup(person: Person, groupId: string) {
  return hasGroupRole(person, groupId, "member");
}

export function canOrganizeGroup(person: Person, groupId: string) {
  return hasGroupRole(person, groupId, "organizer");
}
