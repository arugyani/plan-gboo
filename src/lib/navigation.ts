import {
  Activity,
  Layers3,
  LayoutDashboard,
  ListTodo,
  UserRound,
  UsersRound,
} from "lucide-react";

export type View =
  "board" | "together" | "mine" | "activity" | "groups" | "people";

export const navigationItems = [
  { id: "together" as const, label: "All Together", icon: Layers3 },
  { id: "mine" as const, label: "My List", icon: ListTodo },
  { id: "board" as const, label: "Boards", icon: LayoutDashboard },
  { id: "activity" as const, label: "What’s Happening", icon: Activity },
  { id: "groups" as const, label: "Groups", icon: UsersRound },
  { id: "people" as const, label: "People", icon: UserRound },
];
