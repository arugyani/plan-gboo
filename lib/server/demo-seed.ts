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
  tags,
  user,
} from "@/db/schema";
import { demoDashboard } from "@/lib/demo-data";

export async function ensureDemoData() {
  const db = getDb();
  const existing = await db.select({ id: groups.id }).from(groups).limit(1);
  if (existing.length) return;

  const now = new Date();
  await db.insert(user).values(
    demoDashboard.people.map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      emailVerified: true,
      image: person.image ?? null,
      discordId: person.discordId ?? null,
      systemRole: person.systemRole,
      active: person.active,
      guildVerifiedAt: now.toISOString(),
      createdAt: now,
      updatedAt: now,
    })),
  );

  await db.insert(groups).values(
    demoDashboard.groups.map((group) => ({
      ...group,
      archivedAt: null,
    })),
  );

  const memberships = demoDashboard.people.flatMap((person) =>
    Object.entries(person.groupRoles).map(([groupId, role]) => ({
      groupId,
      userId: person.id,
      role,
    })),
  );
  if (memberships.length) await db.insert(groupMemberships).values(memberships);

  await db.insert(boards).values(demoDashboard.boards);
  await db.insert(columns).values(demoDashboard.columns);
  await db.insert(tags).values(demoDashboard.tags);

  for (const card of demoDashboard.cards) {
    await db.insert(cards).values({
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
      createdBy: demoDashboard.viewer.id,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    });
    if (card.personIds.length) {
      await db
        .insert(cardPeople)
        .values(card.personIds.map((userId) => ({ cardId: card.id, userId })));
    }
    if (card.tagIds.length) {
      await db
        .insert(cardTags)
        .values(card.tagIds.map((tagId) => ({ cardId: card.id, tagId })));
    }
    if (card.checklist.length) {
      await db
        .insert(checklistItems)
        .values(card.checklist.map((item) => ({ ...item, cardId: card.id })));
    }
    if (card.comments.length) {
      await db
        .insert(comments)
        .values(
          card.comments.map((comment) => ({ ...comment, cardId: card.id })),
        );
    }
    if (card.links.length) {
      await db
        .insert(cardLinks)
        .values(card.links.map((link) => ({ ...link, cardId: card.id })));
    }
  }

  await db.insert(activityEvents).values(demoDashboard.activity);
}
