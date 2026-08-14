export type SystemRole = "admin" | "member";
export type GroupRole = "organizer" | "member" | "view_only";
export type Importance = "none" | "low" | "medium" | "high" | "urgent";
export type CardLinkState = "open" | "closed" | "unknown";

export interface Person {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  discordId?: string | null;
  systemRole: SystemRole;
  active: boolean;
  groupRoles: Record<string, GroupRole>;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  icon: "ghost" | "pumpkin" | "bat";
  accent: "pumpkin" | "purple" | "green" | "berry";
  isPrivate: boolean;
  discordChannelId: string | null;
  recapEnabled: boolean;
  recapHourUtc: number;
}

export interface Board {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  note: string;
}

export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  rank: number;
  color: string;
}

export interface Tag {
  id: string;
  groupId: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  complete: boolean;
  rank: number;
}

export interface Comment {
  id: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

export interface GitHubIssueLink {
  id: string;
  kind: "github_issue";
  url: string;
  owner: string;
  repo: string;
  issueNumber: number;
  title?: string | null;
  state: CardLinkState;
}

export interface Card {
  id: string;
  key: string;
  boardId: string;
  columnId: string;
  title: string;
  notes: string;
  importance: Importance;
  when: string | null;
  blocked: boolean;
  blockedReason: string | null;
  rank: number;
  version: number;
  personIds: string[];
  tagIds: string[];
  checklist: ChecklistItem[];
  comments: Comment[];
  links: GitHubIssueLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  actorId: string | null;
  groupId: string | null;
  boardId: string | null;
  cardId: string | null;
  kind: string;
  summary: string;
  createdAt: string;
}

export interface SavedView {
  id: string;
  name: string;
  boardIds: string[];
  filters: Record<string, string | string[]>;
}

export interface NotificationPreferences {
  assignments: boolean;
  mentions: boolean;
  dueSoon: boolean;
  digest: "off" | "daily" | "weekly";
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string;
}

export interface DashboardData {
  viewer: Person;
  people: Person[];
  groups: Group[];
  boards: Board[];
  columns: BoardColumn[];
  cards: Card[];
  tags: Tag[];
  activity: ActivityItem[];
  savedViews: SavedView[];
  notificationPreferences: NotificationPreferences;
  demoMode: boolean;
}

export interface CardPatch {
  title?: string;
  notes?: string;
  importance?: Importance;
  when?: string | null;
  blocked?: boolean;
  blockedReason?: string | null;
  personIds?: string[];
  tagIds?: string[];
  expectedVersion: number;
}

export interface MoveCardInput {
  columnId: string;
  beforeCardId?: string | null;
  expectedVersion: number;
}
