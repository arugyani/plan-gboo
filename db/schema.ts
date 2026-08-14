import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

const authTimestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

// Better Auth core tables. Keep these names and fields aligned with the
// drizzle adapter; product-specific membership stays in separate tables.
export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    discordId: text("discord_id"),
    systemRole: text("system_role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    guildVerifiedAt: text("guild_verified_at"),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("idx_user_email").on(table.email),
    uniqueIndex("idx_user_discord_id").on(table.discordId),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("idx_session_token").on(table.token),
    index("idx_session_user_id").on(table.userId),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (table) => [
    index("idx_account_user_id").on(table.userId),
    uniqueIndex("idx_account_provider_account").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (table) => [index("idx_verification_identifier").on(table.identifier)],
);

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    icon: text("icon").notNull().default("ghost"),
    accent: text("accent").notNull().default("pumpkin"),
    isPrivate: integer("is_private", { mode: "boolean" })
      .notNull()
      .default(true),
    discordChannelId: text("discord_channel_id"),
    recapEnabled: integer("recap_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    recapHourUtc: integer("recap_hour_utc").notNull().default(15),
    lastRecapAt: text("last_recap_at"),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [uniqueIndex("idx_groups_slug").on(table.slug)],
);

export const groupMemberships = sqliteTable(
  "group_memberships",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["organizer", "member", "view_only"],
    })
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("idx_group_memberships_user").on(table.userId),
  ],
);

export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    note: text("note").notNull().default(""),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("idx_boards_group_slug").on(table.groupId, table.slug),
    index("idx_boards_group").on(table.groupId),
  ],
);

export const columns = sqliteTable(
  "columns",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    color: text("color").notNull().default("neutral"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("idx_columns_board_rank").on(table.boardId, table.rank),
  ],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    columnId: text("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    importance: text("importance", {
      enum: ["none", "low", "medium", "high", "urgent"],
    })
      .notNull()
      .default("none"),
    when: text("when"),
    blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
    blockedReason: text("blocked_reason"),
    rank: integer("rank").notNull().default(1024),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("idx_cards_key").on(table.key),
    index("idx_cards_board_column_rank").on(
      table.boardId,
      table.columnId,
      table.rank,
    ),
    index("idx_cards_when").on(table.when),
  ],
);

export const cardPeople = sqliteTable(
  "card_people",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.cardId, table.userId] }),
    index("idx_card_people_user").on(table.userId),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("purple"),
  },
  (table) => [uniqueIndex("idx_tags_group_name").on(table.groupId, table.name)],
);

export const cardTags = sqliteTable(
  "card_tags",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.tagId] })],
);

export const checklistItems = sqliteTable(
  "checklist_items",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    complete: integer("complete", { mode: "boolean" }).notNull().default(false),
    rank: integer("rank").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("idx_checklist_card_rank").on(table.cardId, table.rank)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("idx_comments_card_created").on(table.cardId, table.createdAt),
  ],
);

export const cardLinks = sqliteTable(
  "card_links",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["github_issue"] }).notNull(),
    url: text("url").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    issueNumber: integer("issue_number").notNull(),
    title: text("title"),
    state: text("state", { enum: ["open", "closed", "unknown"] })
      .notNull()
      .default("unknown"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("idx_card_links_card_url").on(table.cardId, table.url),
    index("idx_card_links_repo_issue").on(
      table.owner,
      table.repo,
      table.issueNumber,
    ),
  ],
);

export const savedViews = sqliteTable(
  "saved_views",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    boardIds: text("board_ids", { mode: "json" }).$type<string[]>().notNull(),
    filters: text("filters", { mode: "json" })
      .$type<Record<string, string | string[]>>()
      .notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("idx_saved_views_user").on(table.userId)],
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    boardId: text("board_id").references(() => boards.id, {
      onDelete: "cascade",
    }),
    cardId: text("card_id").references(() => cards.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("idx_activity_group_created").on(table.groupId, table.createdAt),
    index("idx_activity_card_created").on(table.cardId, table.createdAt),
  ],
);

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  assignments: integer("assignments", { mode: "boolean" })
    .notNull()
    .default(true),
  mentions: integer("mentions", { mode: "boolean" }).notNull().default(true),
  dueSoon: integer("due_soon", { mode: "boolean" }).notNull().default(true),
  digest: text("digest", { enum: ["off", "daily", "weekly"] })
    .notNull()
    .default("daily"),
  quietStart: text("quiet_start"),
  quietEnd: text("quiet_end"),
  timezone: text("timezone").notNull().default("America/New_York"),
  updatedAt: timestamp("updated_at"),
});

export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key"),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    status: text("status", {
      enum: ["pending", "processing", "sent", "failed"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: text("available_at").notNull(),
    lockedAt: text("locked_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("idx_outbox_status_available").on(table.status, table.availableAt),
    uniqueIndex("idx_outbox_dedupe").on(table.dedupeKey),
  ],
);

export const interactionReceipts = sqliteTable("interaction_receipts", {
  interactionId: text("interaction_id").primaryKey(),
  response: text("response", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at"),
});
