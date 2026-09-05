import { useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardData, GroupRole } from "@/types";

const roleLabels: Record<GroupRole, string> = {
  organizer: "Organizer",
  member: "Member",
  view_only: "View only",
};

export function PeopleView({
  data,
  onSignOut,
}: {
  data: DashboardData;
  onSignOut?: () => Promise<void>;
}) {
  const activePeople = useMemo(
    () => data.people.filter((person) => person.active),
    [data.people],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">People</h1>
        {onSignOut ? (
          <Button variant="outline" onClick={() => void onSignOut()}>
            Sign out
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {activePeople.map((person) => {
          const groups = data.groups.filter(
            (group) => person.groupRoles[group.id],
          );
          return (
            <div
              key={person.id}
              className="flex min-h-16 flex-col gap-3 border-b border-border px-5 py-4 last:border-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar
                  name={person.name}
                  src={person.image}
                  className="size-9"
                />
                <span className="truncate text-sm font-semibold">
                  {person.name}
                  {person.id === data.viewer.id ? " (you)" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((group) => (
                  <Badge key={group.id} variant="neutral">
                    {group.name} · {roleLabels[person.groupRoles[group.id]]}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
