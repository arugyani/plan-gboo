import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityEvents,
  boards,
  cardLinks,
  cardPeople,
  cardTags,
  cards,
  checklistItems,
  columns,
  comments,
  groupMemberships,
  groups,
  notificationPreferences,
  outbox,
  savedViews,
  tags,
  user,
} from "@/db/schema";
import { parseGitHubIssueUrl } from "@/lib/github";
import {
  canEditGroup,
  canOrganizeGroup,
  canViewGroup,
} from "@/lib/permissions";
import type {
  Card,
  CardPatch,
  DashboardData,
  GitHubIssueLink,
  GroupRole,
  MoveCardInput,
  Person,
} from "@/lib/types";
import { slugify } from "@/lib/utils";
import { HttpError } from "./errors";

function groupRowsBy<T, K>(rows: T[], keyFor: (row: T) => K) {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }
  return grouped;
}

async function loadPeople(): Promise<Person[]> {
  const db = getDb();
  const [peopleRows, membershipRows] = await Promise.all([
    db.select().from(user).orderBy(asc(user.name)),
    db.select().from(groupMemberships),
  ]);
  const roles = new Map<string, Record<string, GroupRole>>();
  for (const membership of membershipRows) {
    const current = roles.get(membership.userId) ?? {};
    current[membership.groupId] = membership.role;
    roles.set(membership.userId, current);
  }
  return peopleRows.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    image: person.image,
    discordId: person.discordId,
    systemRole: person.systemRole,
    active: person.active,
    groupRoles: roles.get(person.id) ?? {},
  }));
}

export async function loadDashboard(viewer: Person): Promise<DashboardData> {
  const db = getDb();
  const [
    people,
    groupRows,
    boardRows,
    columnRows,
    cardRows,
    peopleLinks,
    tagRows,
    tagLinks,
    checklistRows,
    commentRows,
    githubRows,
    activityRows,
    savedViewRows,
    preferenceRows,
  ] = await Promise.all([
    loadPeople(),
    db
      .select()
      .from(groups)
      .where(isNull(groups.archivedAt))
      .orderBy(asc(groups.name)),
    db
      .select()
      .from(boards)
      .where(isNull(boards.archivedAt))
      .orderBy(asc(boards.name)),
    db.select().from(columns).orderBy(asc(columns.rank)),
    db
      .select()
      .from(cards)
      .where(isNull(cards.archivedAt))
      .orderBy(asc(cards.columnId), asc(cards.rank)),
    db.select().from(cardPeople),
    db.select().from(tags).orderBy(asc(tags.name)),
    db.select().from(cardTags),
    db.select().from(checklistItems).orderBy(asc(checklistItems.rank)),
    db.select().from(comments).orderBy(asc(comments.createdAt)),
    db.select().from(cardLinks),
    db
      .select()
      .from(activityEvents)
      .orderBy(desc(activityEvents.createdAt))
      .limit(50),
    db
      .select()
      .from(savedViews)
      .where(eq(savedViews.userId, viewer.id))
      .orderBy(asc(savedViews.name)),
    db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, viewer.id))
      .limit(1),
  ]);

  const visibleGroups = groupRows.filter(
    (group) => !group.isPrivate || canViewGroup(viewer, group.id),
  );
  const groupIds = new Set(visibleGroups.map((group) => group.id));
  const visibleBoards = boardRows.filter((board) =>
    groupIds.has(board.groupId),
  );
  const boardIds = new Set(visibleBoards.map((board) => board.id));
  const visibleCards = cardRows.filter((card) => boardIds.has(card.boardId));
  const peopleByCard = groupRowsBy(peopleLinks, (link) => link.cardId);
  const tagsByCard = groupRowsBy(tagLinks, (link) => link.cardId);
  const checklistByCard = groupRowsBy(checklistRows, (item) => item.cardId);
  const commentsByCard = groupRowsBy(commentRows, (comment) => comment.cardId);
  const linksByCard = groupRowsBy(githubRows, (link) => link.cardId);
  return {
    demoMode: process.env.DEMO_MODE === "true",
    viewer,
    people: people.filter((person) =>
      viewer.systemRole === "admin"
        ? true
        : Object.keys(person.groupRoles).some((id) => groupIds.has(id)),
    ),
    groups: visibleGroups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      icon: group.icon as "ghost" | "pumpkin" | "bat",
      accent: group.accent as "pumpkin" | "purple" | "green" | "berry",
      isPrivate: group.isPrivate,
      discordChannelId: group.discordChannelId,
      recapEnabled: group.recapEnabled,
      recapHourUtc: group.recapHourUtc,
    })),
    boards: visibleBoards.map((board) => ({
      id: board.id,
      groupId: board.groupId,
      name: board.name,
      slug: board.slug,
      note: board.note,
    })),
    columns: columnRows
      .filter((column) => boardIds.has(column.boardId))
      .map((column) => ({
        id: column.id,
        boardId: column.boardId,
        name: column.name,
        rank: column.rank,
        color: column.color,
      })),
    cards: visibleCards.map(
      (card): Card => ({
        id: card.id,
        key: card.key,
        boardId: card.boardId,
        columnId: card.columnId,
        title: card.title,
        notes: card.notes,
        importance: card.importance,
        when: card.when,
        blocked: card.blocked,
        blockedReason: card.blockedReason,
        rank: card.rank,
        version: card.version,
        personIds: (peopleByCard.get(card.id) ?? []).map((link) => link.userId),
        tagIds: (tagsByCard.get(card.id) ?? []).map((link) => link.tagId),
        checklist: (checklistByCard.get(card.id) ?? []).map((item) => ({
          id: item.id,
          text: item.text,
          complete: item.complete,
          rank: item.rank,
        })),
        comments: (commentsByCard.get(card.id) ?? []).map((comment) => ({
          id: comment.id,
          authorId: comment.authorId,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
        links: (linksByCard.get(card.id) ?? []).map((link) => ({
          id: link.id,
          kind: link.kind,
          url: link.url,
          owner: link.owner,
          repo: link.repo,
          issueNumber: link.issueNumber,
          title: link.title,
          state: link.state,
        })),
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      }),
    ),
    tags: tagRows
      .filter((tag) => groupIds.has(tag.groupId))
      .map((tag) => ({
        id: tag.id,
        groupId: tag.groupId,
        name: tag.name,
        color: tag.color,
      })),
    activity: activityRows
      .filter((item) => !item.groupId || groupIds.has(item.groupId))
      .map((item) => ({
        id: item.id,
        actorId: item.actorId,
        groupId: item.groupId,
        boardId: item.boardId,
        cardId: item.cardId,
        kind: item.kind,
        summary: item.summary,
        createdAt: item.createdAt,
      })),
    savedViews: savedViewRows.map((view) => ({
      id: view.id,
      name: view.name,
      boardIds: view.boardIds,
      filters: view.filters,
    })),
    notificationPreferences: preferenceRows[0]
      ? {
          assignments: preferenceRows[0].assignments,
          mentions: preferenceRows[0].mentions,
          dueSoon: preferenceRows[0].dueSoon,
          digest: preferenceRows[0].digest,
          quietStart: preferenceRows[0].quietStart,
          quietEnd: preferenceRows[0].quietEnd,
          timezone: preferenceRows[0].timezone,
        }
      : {
          assignments: true,
          mentions: true,
          dueSoon: true,
          digest: "daily",
          quietStart: null,
          quietEnd: null,
          timezone: "America/New_York",
        },
  };
}

async function getCardContext(cardId: string) {
  const db = getDb();
  const [result] = await db
    .select({ card: cards, board: boards })
    .from(cards)
    .innerJoin(boards, eq(cards.boardId, boards.id))
    .where(and(eq(cards.id, cardId), isNull(cards.archivedAt)))
    .limit(1);
  if (!result)
    throw new HttpError(404, "card_not_found", "That card could not be found.");
  return result;
}

function recordActivity(
  viewer: Person,
  context: Awaited<ReturnType<typeof getCardContext>>,
  kind: string,
  summary: string,
) {
  return getDb().insert(activityEvents).values({
    id: crypto.randomUUID(),
    actorId: viewer.id,
    groupId: context.board.groupId,
    boardId: context.board.id,
    cardId: context.card.id,
    kind,
    summary,
  });
}

export async function updateCard(
  viewer: Person,
  cardId: string,
  patch: CardPatch,
) {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not change it.",
    );
  }
  const db = getDb();
  const now = new Date().toISOString();
  const previousPeople = patch.personIds
    ? await db
        .select({ userId: cardPeople.userId })
        .from(cardPeople)
        .where(eq(cardPeople.cardId, cardId))
    : [];
  const [updated] = await db
    .update(cards)
    .set({
      title: patch.title?.trim() || context.card.title,
      notes: patch.notes ?? context.card.notes,
      importance: patch.importance ?? context.card.importance,
      when: patch.when === undefined ? context.card.when : patch.when,
      blocked: patch.blocked ?? context.card.blocked,
      blockedReason:
        patch.blockedReason === undefined
          ? context.card.blockedReason
          : patch.blockedReason,
      version: sql`${cards.version} + 1`,
      updatedAt: now,
    })
    .where(and(eq(cards.id, cardId), eq(cards.version, patch.expectedVersion)))
    .returning();
  if (!updated) {
    throw new HttpError(
      409,
      "card_changed",
      "This card changed while you were looking at it. We refreshed it so your changes are not lost.",
    );
  }

  if (patch.personIds) {
    await db.delete(cardPeople).where(eq(cardPeople.cardId, cardId));
    if (patch.personIds.length) {
      await db
        .insert(cardPeople)
        .values(
          [...new Set(patch.personIds)].map((userId) => ({ cardId, userId })),
        );
    }
    const priorIds = new Set(previousPeople.map((person) => person.userId));
    const addedIds = [...new Set(patch.personIds)].filter(
      (userId) => !priorIds.has(userId) && userId !== viewer.id,
    );
    for (const userId of addedIds) {
      try {
        const [recipient] = await db
          .select({
            discordId: user.discordId,
            active: user.active,
            assignments: notificationPreferences.assignments,
          })
          .from(user)
          .leftJoin(
            notificationPreferences,
            eq(notificationPreferences.userId, user.id),
          )
          .where(eq(user.id, userId))
          .limit(1);
        if (
          recipient?.discordId &&
          recipient.active &&
          recipient.assignments !== false
        ) {
          await db
            .insert(outbox)
            .values({
              id: crypto.randomUUID(),
              kind: "discord_assignment",
              dedupeKey: `assignment:${cardId}:${userId}:${updated.version}`,
              payload: {
                userId: recipient.discordId,
                content: `🎃 ${viewer.name} put you on **${updated.key} · ${updated.title}**.`,
              },
              availableAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoNothing();
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "notification.assignment_queue_failed",
            cardId,
            userId,
            message: error instanceof Error ? error.message : "Unknown error",
          }),
        );
      }
    }
  }
  if (patch.tagIds) {
    await db.delete(cardTags).where(eq(cardTags.cardId, cardId));
    if (patch.tagIds.length) {
      await db
        .insert(cardTags)
        .values([...new Set(patch.tagIds)].map((tagId) => ({ cardId, tagId })));
    }
  }
  await recordActivity(viewer, context, "updated", `updated ${updated.title}`);
  return updated;
}

export async function moveCard(
  viewer: Person,
  cardId: string,
  input: MoveCardInput,
) {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not move it.",
    );
  }
  const db = getDb();
  const [destination] = await db
    .select()
    .from(columns)
    .where(eq(columns.id, input.columnId))
    .limit(1);
  if (!destination || destination.boardId !== context.board.id) {
    throw new HttpError(
      400,
      "invalid_column",
      "Choose a column on this board.",
    );
  }

  let nextRank = 1024;
  if (input.beforeCardId) {
    const [target] = await db
      .select({ rank: cards.rank, columnId: cards.columnId })
      .from(cards)
      .where(eq(cards.id, input.beforeCardId))
      .limit(1);
    if (target?.columnId === destination.id) {
      const [previous] = await db
        .select({ rank: cards.rank })
        .from(cards)
        .where(
          and(
            eq(cards.columnId, destination.id),
            sql`${cards.rank} < ${target.rank}`,
            isNull(cards.archivedAt),
          ),
        )
        .orderBy(desc(cards.rank))
        .limit(1);
      nextRank = previous
        ? Math.floor((previous.rank + target.rank) / 2)
        : Math.floor(target.rank / 2);
    }
  } else {
    const [last] = await db
      .select({ rank: cards.rank })
      .from(cards)
      .where(and(eq(cards.columnId, destination.id), isNull(cards.archivedAt)))
      .orderBy(desc(cards.rank))
      .limit(1);
    nextRank = (last?.rank ?? 0) + 1024;
  }

  const [updated] = await db
    .update(cards)
    .set({
      columnId: destination.id,
      rank: nextRank,
      version: sql`${cards.version} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(cards.id, cardId), eq(cards.version, input.expectedVersion)))
    .returning();
  if (!updated) {
    throw new HttpError(
      409,
      "card_changed",
      "This card moved somewhere else first. The board has been refreshed.",
    );
  }
  await recordActivity(
    viewer,
    context,
    "moved",
    `moved ${updated.title} to ${destination.name}`,
  );
  return updated;
}

export async function createCard(
  viewer: Person,
  input: {
    boardId: string;
    columnId: string;
    title: string;
    notes?: string;
    importance?: Card["importance"];
    when?: string | null;
    personIds?: string[];
  },
) {
  const db = getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, input.boardId))
    .limit(1);
  if (!board)
    throw new HttpError(
      404,
      "board_not_found",
      "That board could not be found.",
    );
  if (!canEditGroup(viewer, board.groupId)) {
    throw new HttpError(
      403,
      "board_read_only",
      "You can look at this board, but not add cards.",
    );
  }
  const [column] = await db
    .select()
    .from(columns)
    .where(eq(columns.id, input.columnId))
    .limit(1);
  if (!column || column.boardId !== board.id) {
    throw new HttpError(
      400,
      "invalid_column",
      "Choose a column on this board.",
    );
  }
  const title = input.title.trim();
  if (!title)
    throw new HttpError(400, "title_required", "Give this card a short title.");

  const [count] = await db
    .select({ value: sql<number>`count(*)` })
    .from(cards)
    .where(eq(cards.boardId, board.id));
  const prefix =
    board.slug
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 5)
      .toUpperCase() || "CARD";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const [last] = await db
    .select({ rank: cards.rank })
    .from(cards)
    .where(and(eq(cards.columnId, column.id), isNull(cards.archivedAt)))
    .orderBy(desc(cards.rank))
    .limit(1);
  const [created] = await db
    .insert(cards)
    .values({
      id,
      key: `${prefix}-${Number(count?.value ?? 0) + 1}`,
      boardId: board.id,
      columnId: column.id,
      title,
      notes: input.notes?.trim() ?? "",
      importance: input.importance ?? "none",
      when: input.when ?? null,
      rank: (last?.rank ?? 0) + 1024,
      createdBy: viewer.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (input.personIds?.length) {
    await db
      .insert(cardPeople)
      .values(
        [...new Set(input.personIds)].map((userId) => ({ cardId: id, userId })),
      );
  }
  await db.insert(activityEvents).values({
    id: crypto.randomUUID(),
    actorId: viewer.id,
    groupId: board.groupId,
    boardId: board.id,
    cardId: id,
    kind: "created",
    summary: `added ${title}`,
  });
  return created;
}

export async function addGitHubLink(
  viewer: Person,
  cardId: string,
  url: string,
): Promise<GitHubIssueLink> {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not change its links.",
    );
  }
  const parsed = parseGitHubIssueUrl(url);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "invalid_github_issue",
      parsed.error.issues[0]?.message ?? "That is not a GitHub issue link.",
    );
  }
  const db = getDb();
  const link: GitHubIssueLink = {
    id: crypto.randomUUID(),
    kind: "github_issue",
    ...parsed.data,
    title: null,
    state: "unknown",
  };
  await db.insert(cardLinks).values({ ...link, cardId });
  await recordActivity(
    viewer,
    context,
    "linked",
    `linked ${link.owner}/${link.repo}#${link.issueNumber}`,
  );
  return link;
}

export async function removeGitHubLink(
  viewer: Person,
  cardId: string,
  linkId: string,
) {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not change its links.",
    );
  }
  await getDb()
    .delete(cardLinks)
    .where(and(eq(cardLinks.id, linkId), eq(cardLinks.cardId, cardId)));
}

export async function addComment(viewer: Person, cardId: string, body: string) {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not add a note.",
    );
  }
  const clean = body.trim();
  if (!clean) throw new HttpError(400, "note_required", "Write a note first.");
  const [created] = await getDb()
    .insert(comments)
    .values({
      id: crypto.randomUUID(),
      cardId,
      authorId: viewer.id,
      body: clean,
    })
    .returning();
  await recordActivity(
    viewer,
    context,
    "commented",
    `left a note on ${context.card.title}`,
  );
  return created;
}

export async function addChecklistItem(
  viewer: Person,
  cardId: string,
  text: string,
) {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not change its checklist.",
    );
  }
  const clean = text.trim();
  if (!clean)
    throw new HttpError(
      400,
      "checklist_text_required",
      "Add a short checklist item.",
    );
  const db = getDb();
  const [last] = await db
    .select({ rank: checklistItems.rank })
    .from(checklistItems)
    .where(eq(checklistItems.cardId, cardId))
    .orderBy(desc(checklistItems.rank))
    .limit(1);
  const [created] = await db
    .insert(checklistItems)
    .values({
      id: crypto.randomUUID(),
      cardId,
      text: clean,
      rank: (last?.rank ?? 0) + 1024,
    })
    .returning();
  await recordActivity(
    viewer,
    context,
    "checklist",
    `added a checklist item to ${context.card.title}`,
  );
  return created;
}

export async function setChecklistItem(
  viewer: Person,
  cardId: string,
  itemId: string,
  complete: boolean,
) {
  const context = await getCardContext(cardId);
  if (!canEditGroup(viewer, context.board.groupId)) {
    throw new HttpError(
      403,
      "card_read_only",
      "You can look at this card, but not change its checklist.",
    );
  }
  const [updated] = await getDb()
    .update(checklistItems)
    .set({ complete, updatedAt: new Date().toISOString() })
    .where(
      and(eq(checklistItems.id, itemId), eq(checklistItems.cardId, cardId)),
    )
    .returning();
  if (!updated)
    throw new HttpError(
      404,
      "checklist_item_not_found",
      "That checklist item is gone.",
    );
  await recordActivity(
    viewer,
    context,
    "checklist",
    `${complete ? "checked off" : "reopened"} ${updated.text}`,
  );
  return updated;
}

export async function createGroup(viewer: Person, name: string) {
  if (viewer.systemRole !== "admin") {
    throw new HttpError(
      403,
      "admin_required",
      "Only an admin can add a group.",
    );
  }
  const clean = name.trim();
  if (!clean)
    throw new HttpError(400, "name_required", "Give the group a name.");
  const db = getDb();
  const groupId = crypto.randomUUID();
  const boardId = crypto.randomUUID();
  const slug = `${slugify(clean)}-${groupId.slice(0, 4)}`;
  await db.insert(groups).values({
    id: groupId,
    name: clean,
    slug,
    icon: "ghost",
    accent: "purple",
  });
  await db
    .insert(groupMemberships)
    .values({ groupId, userId: viewer.id, role: "organizer" });
  await db.insert(boards).values({
    id: boardId,
    groupId,
    name: "Main Board",
    slug: "main-board",
    note: "A shared place to keep everyone in the loop.",
  });
  await db.insert(columns).values(
    ["Ideas", "Up Next", "Doing", "Waiting", "Done"].map(
      (columnName, index) => ({
        id: crypto.randomUUID(),
        boardId,
        name: columnName,
        rank: (index + 1) * 1024,
        color: ["purple", "pumpkin", "green", "berry", "neutral"][index],
      }),
    ),
  );
  return { id: groupId, name: clean, slug };
}

export async function createBoard(
  viewer: Person,
  groupId: string,
  name: string,
) {
  if (!canOrganizeGroup(viewer, groupId)) {
    throw new HttpError(
      403,
      "organizer_required",
      "Only a group organizer can add a board.",
    );
  }
  const clean = name.trim();
  if (!clean)
    throw new HttpError(400, "name_required", "Give the board a name.");
  const db = getDb();
  const boardId = crypto.randomUUID();
  await db.insert(boards).values({
    id: boardId,
    groupId,
    name: clean,
    slug: `${slugify(clean)}-${boardId.slice(0, 4)}`,
    note: "A shared place to keep everyone in the loop.",
  });
  await db.insert(columns).values(
    ["Ideas", "Up Next", "Doing", "Waiting", "Done"].map(
      (columnName, index) => ({
        id: crypto.randomUUID(),
        boardId,
        name: columnName,
        rank: (index + 1) * 1024,
        color: ["purple", "pumpkin", "green", "berry", "neutral"][index],
      }),
    ),
  );
  return { id: boardId, name: clean };
}

export async function createTag(
  viewer: Person,
  groupId: string,
  name: string,
  color: "pumpkin" | "purple" | "green" | "berry",
) {
  if (!canOrganizeGroup(viewer, groupId)) {
    throw new HttpError(
      403,
      "organizer_required",
      "Only a group organizer can add tags.",
    );
  }
  const clean = name.trim();
  if (!clean) throw new HttpError(400, "name_required", "Give the tag a name.");
  const [tag] = await getDb()
    .insert(tags)
    .values({ id: crypto.randomUUID(), groupId, name: clean, color })
    .onConflictDoNothing()
    .returning();
  if (!tag) {
    throw new HttpError(
      409,
      "tag_exists",
      "That group already has a tag with this name.",
    );
  }
  return tag;
}

export async function updateGroup(
  viewer: Person,
  groupId: string,
  input: {
    name?: string;
    icon?: "ghost" | "pumpkin" | "bat";
    accent?: "pumpkin" | "purple" | "green" | "berry";
    discordChannelId?: string | null;
    recapEnabled?: boolean;
    recapHourUtc?: number;
  },
) {
  if (!canOrganizeGroup(viewer, groupId)) {
    throw new HttpError(
      403,
      "organizer_required",
      "Only a group organizer can change this group.",
    );
  }
  const [existing] = await getDb()
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!existing || existing.archivedAt) {
    throw new HttpError(
      404,
      "group_not_found",
      "That group could not be found.",
    );
  }
  const [updated] = await getDb()
    .update(groups)
    .set({
      name: input.name?.trim() || existing.name,
      icon: input.icon ?? existing.icon,
      accent: input.accent ?? existing.accent,
      discordChannelId:
        input.discordChannelId === undefined
          ? existing.discordChannelId
          : input.discordChannelId,
      recapEnabled: input.recapEnabled ?? existing.recapEnabled,
      recapHourUtc: input.recapHourUtc ?? existing.recapHourUtc,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(groups.id, groupId))
    .returning();
  return updated;
}

export async function setGroupMembership(
  viewer: Person,
  groupId: string,
  userId: string,
  role: GroupRole | null,
) {
  if (!canOrganizeGroup(viewer, groupId)) {
    throw new HttpError(
      403,
      "organizer_required",
      "Only a group organizer can change who is in this group.",
    );
  }
  const db = getDb();
  const [[group], [person]] = await Promise.all([
    db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1),
    db
      .select({ id: user.id, active: user.active })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
  ]);
  if (!group)
    throw new HttpError(
      404,
      "group_not_found",
      "That group could not be found.",
    );
  if (!person?.active)
    throw new HttpError(404, "person_not_found", "That person is not active.");

  if (role === null) {
    if (userId === viewer.id && viewer.systemRole !== "admin") {
      throw new HttpError(
        400,
        "self_removal_blocked",
        "Ask another organizer to remove you from this group.",
      );
    }
    await db
      .delete(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, userId),
        ),
      );
    return { userId, role: null };
  }

  await db
    .insert(groupMemberships)
    .values({ groupId, userId, role })
    .onConflictDoUpdate({
      target: [groupMemberships.groupId, groupMemberships.userId],
      set: { role },
    });
  return { userId, role };
}

export async function updatePersonAccess(
  viewer: Person,
  userId: string,
  input: { systemRole?: "admin" | "member"; active?: boolean },
) {
  if (viewer.systemRole !== "admin") {
    throw new HttpError(
      403,
      "admin_required",
      "Only an admin can change account access.",
    );
  }
  if (viewer.id === userId) {
    throw new HttpError(
      400,
      "self_access_change_blocked",
      "Ask another admin to change your own account access.",
    );
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!existing) {
    throw new HttpError(404, "person_not_found", "That person was not found.");
  }
  const removingAdmin =
    existing.systemRole === "admin" &&
    (input.systemRole === "member" || input.active === false);
  if (removingAdmin) {
    const [adminCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(user)
      .where(and(eq(user.systemRole, "admin"), eq(user.active, true)));
    if (Number(adminCount?.value ?? 0) <= 1) {
      throw new HttpError(
        400,
        "last_admin_required",
        "Keep at least one active admin for recovery.",
      );
    }
  }
  const [updated] = await db
    .update(user)
    .set({
      systemRole: input.systemRole ?? existing.systemRole,
      active: input.active ?? existing.active,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning({
      id: user.id,
      systemRole: user.systemRole,
      active: user.active,
    });
  return updated;
}

export async function updateBoard(
  viewer: Person,
  boardId: string,
  input: { name?: string; note?: string },
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!existing || existing.archivedAt) {
    throw new HttpError(
      404,
      "board_not_found",
      "That board could not be found.",
    );
  }
  if (!canOrganizeGroup(viewer, existing.groupId)) {
    throw new HttpError(
      403,
      "organizer_required",
      "Only a group organizer can change this board.",
    );
  }
  const [updated] = await db
    .update(boards)
    .set({
      name: input.name?.trim() || existing.name,
      note: input.note === undefined ? existing.note : input.note.trim(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(boards.id, boardId))
    .returning();
  return updated;
}

export async function updateColumn(
  viewer: Person,
  boardId: string,
  columnId: string,
  input: { name?: string; direction?: "up" | "down" },
) {
  const db = getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board)
    throw new HttpError(
      404,
      "board_not_found",
      "That board could not be found.",
    );
  if (!canOrganizeGroup(viewer, board.groupId)) {
    throw new HttpError(
      403,
      "organizer_required",
      "Only a group organizer can change the columns.",
    );
  }
  const ordered = await db
    .select()
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(asc(columns.rank));
  const index = ordered.findIndex((column) => column.id === columnId);
  const current = ordered[index];
  if (!current)
    throw new HttpError(
      404,
      "column_not_found",
      "That column could not be found.",
    );

  if (input.name?.trim()) {
    await db
      .update(columns)
      .set({ name: input.name.trim(), updatedAt: new Date().toISOString() })
      .where(eq(columns.id, columnId));
  }
  if (input.direction) {
    const swapIndex = input.direction === "up" ? index - 1 : index + 1;
    const swap = ordered[swapIndex];
    if (swap) {
      // A temporary rank keeps the board/rank unique index valid while swapping.
      await db
        .update(columns)
        .set({ rank: -1 })
        .where(eq(columns.id, current.id));
      await db
        .update(columns)
        .set({ rank: current.rank })
        .where(eq(columns.id, swap.id));
      await db
        .update(columns)
        .set({ rank: swap.rank })
        .where(eq(columns.id, current.id));
    }
  }
  const [updated] = await db
    .select()
    .from(columns)
    .where(eq(columns.id, columnId))
    .limit(1);
  return updated;
}

export async function createSavedView(
  viewer: Person,
  input: {
    name: string;
    boardIds: string[];
    filters?: Record<string, string | string[]>;
  },
) {
  const clean = input.name.trim();
  if (!clean)
    throw new HttpError(
      400,
      "view_name_required",
      "Give this view a short name.",
    );
  const data = await loadDashboard(viewer);
  const visibleBoardIds = new Set(data.boards.map((board) => board.id));
  const boardIds = [...new Set(input.boardIds)].filter((id) =>
    visibleBoardIds.has(id),
  );
  if (!boardIds.length)
    throw new HttpError(
      400,
      "view_boards_required",
      "Choose at least one board for this view.",
    );
  const [created] = await getDb()
    .insert(savedViews)
    .values({
      id: crypto.randomUUID(),
      userId: viewer.id,
      name: clean,
      boardIds,
      filters: input.filters ?? {},
    })
    .returning();
  return created;
}

export async function deleteSavedView(viewer: Person, viewId: string) {
  const [deleted] = await getDb()
    .delete(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.userId, viewer.id)))
    .returning({ id: savedViews.id });
  if (!deleted)
    throw new HttpError(
      404,
      "view_not_found",
      "That saved view could not be found.",
    );
  return deleted;
}

export async function saveNotificationPreferences(
  viewer: Person,
  input: {
    assignments: boolean;
    mentions: boolean;
    dueSoon: boolean;
    digest: "off" | "daily" | "weekly";
    quietStart: string | null;
    quietEnd: string | null;
    timezone: string;
  },
) {
  const values = {
    userId: viewer.id,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await getDb()
    .insert(notificationPreferences)
    .values(values)
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: input,
    });
  return input;
}
