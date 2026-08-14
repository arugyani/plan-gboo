import { eq } from "drizzle-orm";
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
} from "discord-interactions";
import { waitUntil } from "cloudflare:workers";
import { getDb } from "@/db";
import { interactionReceipts } from "@/db/schema";
import { verifyDiscordRequest } from "@/lib/discord/verify";
import { ensureDemoData } from "@/lib/server/demo-seed";
import { getDiscordViewer, isDemoMode } from "@/lib/server/auth";
import {
  addChecklistItem,
  addComment,
  addGitHubLink,
  createCard,
  loadDashboard,
  moveCard,
  setChecklistItem,
  updateCard,
} from "@/lib/server/dashboard";
import { HttpError } from "@/lib/server/errors";
import type { Card, DashboardData, Importance, Person } from "@/lib/types";

interface InteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: InteractionOption[];
}

interface DiscordInteraction {
  id: string;
  type: number;
  guild_id?: string;
  channel_id?: string;
  token?: string;
  member?: { user?: { id: string; username?: string } };
  user?: { id: string; username?: string };
  data?: {
    name?: string;
    custom_id?: string;
    target_id?: string;
    options?: InteractionOption[];
    components?: Array<{
      components?: Array<{ custom_id?: string; value?: string }>;
    }>;
    resolved?: {
      messages?: Record<string, { content?: string; channel_id?: string }>;
    };
  };
}

type InteractionResponse = Record<string, unknown>;

const ephemeral = (
  content: string,
  components?: unknown[],
): InteractionResponse => ({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: {
    content,
    flags: InteractionResponseFlags.EPHEMERAL,
    ...(components ? { components } : {}),
  },
});

const publicMessage = (content: string): InteractionResponse => ({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: { content, allowed_mentions: { parse: [] } },
});

const deferredEphemeral = (): InteractionResponse => ({
  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  data: { flags: InteractionResponseFlags.EPHEMERAL },
});

const option = (options: InteractionOption[] | undefined, name: string) =>
  options?.find((item) => item.name === name)?.value;

function subcommand(interaction: DiscordInteraction) {
  const first = interaction.data?.options?.[0];
  return {
    name: first?.name ?? "",
    options: first?.options ?? [],
  };
}

function personForDiscord(data: DashboardData, discordId: string) {
  return data.people.find((person) => person.discordId === discordId);
}

function findCard(data: DashboardData, keyValue: unknown) {
  const key = String(keyValue ?? "").toUpperCase();
  const card = data.cards.find(
    (candidate) => candidate.key.toUpperCase() === key,
  );
  if (!card)
    throw new HttpError(
      404,
      "card_not_found",
      `I could not find ${key || "that card"}.`,
    );
  return card;
}

function cardMessage(data: DashboardData, card: Card, origin: string) {
  const column = data.columns.find((item) => item.id === card.columnId);
  const people = card.personIds
    .map((id) => data.people.find((person) => person.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const done = card.checklist.filter((item) => item.complete).length;
  const links = card.links
    .map(
      (link) => `[${link.owner}/${link.repo}#${link.issueNumber}](${link.url})`,
    )
    .join(" · ");
  const lines = [
    `**${card.key} · ${card.title}**`,
    `${column?.name ?? "Unknown column"}${card.blocked ? ` · 🕸️ Waiting${card.blockedReason ? `: ${card.blockedReason}` : ""}` : ""}`,
    people ? `People: ${people}` : "Nobody is on this yet",
    card.when ? `When: ${card.when}` : null,
    card.checklist.length
      ? `Checklist: ${done}/${card.checklist.length}`
      : null,
    links || null,
  ].filter(Boolean);
  return ephemeral(lines.join("\n"), [
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: "Join this", custom_id: `join:${card.id}` },
        { type: 2, style: 2, label: "Move", custom_id: `move:${card.id}` },
        {
          type: 2,
          style: 2,
          label: "Waiting",
          custom_id: `waiting:${card.id}`,
        },
        { type: 2, style: 2, label: "Add note", custom_id: `note:${card.id}` },
        { type: 2, style: 3, label: "Mark done", custom_id: `done:${card.id}` },
      ],
    },
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: "Open The Board",
          url: `${origin}/?card=${card.key}`,
        },
      ],
    },
  ]);
}

function modal(
  customId: string,
  title: string,
  fields: Array<{
    id: string;
    label: string;
    value?: string;
    style?: 1 | 2;
    required?: boolean;
  }>,
) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId,
      title,
      components: fields.map((field) => ({
        type: 1,
        components: [
          {
            type: 4,
            custom_id: field.id,
            label: field.label,
            style: field.style ?? 1,
            required: field.required ?? true,
            ...(field.value ? { value: field.value.slice(0, 4000) } : {}),
          },
        ],
      })),
    },
  };
}

function modalValues(interaction: DiscordInteraction) {
  return Object.fromEntries(
    (interaction.data?.components ?? []).flatMap((row) =>
      (row.components ?? [])
        .filter((field) => field.custom_id)
        .map((field) => [field.custom_id as string, field.value ?? ""]),
    ),
  );
}

async function claimInteraction(id: string) {
  const db = getDb();
  const inserted = await db
    .insert(interactionReceipts)
    .values({ interactionId: id })
    .onConflictDoNothing()
    .returning({ interactionId: interactionReceipts.interactionId });
  if (inserted.length) return null;
  const [existing] = await db
    .select({ response: interactionReceipts.response })
    .from(interactionReceipts)
    .where(eq(interactionReceipts.interactionId, id))
    .limit(1);
  return (
    existing?.response ?? ephemeral("That update is already being handled.")
  );
}

async function saveInteraction(id: string, response: InteractionResponse) {
  await getDb()
    .update(interactionReceipts)
    .set({ response })
    .where(eq(interactionReceipts.interactionId, id));
  return response;
}

async function handleCommand(
  interaction: DiscordInteraction,
  viewer: Person,
  data: DashboardData,
  origin: string,
): Promise<InteractionResponse> {
  const command = interaction.data?.name;
  if (command === "my-list") {
    const mine = data.cards
      .filter((card) => card.personIds.includes(viewer.id))
      .sort((a, b) => (a.when ?? "9999").localeCompare(b.when ?? "9999"))
      .slice(0, 10);
    if (!mine.length)
      return ephemeral("Your list is clear. A rare and lovely sight. 🎃");
    return ephemeral(
      [
        "**My List**",
        ...mine.map(
          (card) =>
            `• **${card.key}** ${card.title}${card.when ? ` · ${card.when}` : ""}`,
        ),
      ].join("\n"),
    );
  }

  if (command === "Add to The Board") {
    const targetId = interaction.data?.target_id;
    const message = targetId
      ? interaction.data?.resolved?.messages?.[targetId]
      : undefined;
    const source =
      targetId && interaction.guild_id && interaction.channel_id
        ? `https://discord.com/channels/${interaction.guild_id}/${interaction.channel_id}/${targetId}`
        : "";
    return modal("message_add", "Add to The Board", [
      {
        id: "title",
        label: "Card title",
        value: message?.content?.slice(0, 100) || "Discord follow-up",
      },
      {
        id: "notes",
        label: "Notes",
        style: 2,
        value: [message?.content, source].filter(Boolean).join("\n\n"),
      },
    ]);
  }

  if (command === "board") {
    const sub = subcommand(interaction);
    const requested = String(option(sub.options, "board") ?? "").toLowerCase();
    const board = data.boards.find(
      (item) =>
        !requested ||
        item.id === requested ||
        item.name.toLowerCase().includes(requested),
    );
    if (!board)
      throw new HttpError(
        404,
        "board_not_found",
        "I could not find that board.",
      );
    const boardCards = data.cards.filter((card) => card.boardId === board.id);
    const lines = data.columns
      .filter((column) => column.boardId === board.id)
      .map(
        (column) =>
          `${column.name}: ${boardCards.filter((card) => card.columnId === column.id).length}`,
      );
    const waiting = boardCards.filter((card) => card.blocked).length;
    return publicMessage(
      `**${board.name}**\n${lines.join(" · ")}\n${waiting ? `🕸️ ${waiting} waiting` : "Nothing is waiting"}`,
    );
  }

  if (command !== "card") return ephemeral("I do not know that command yet.");
  const sub = subcommand(interaction);
  if (sub.name === "add") {
    const requested = String(option(sub.options, "board") ?? "").toLowerCase();
    const board = data.boards.find(
      (item) =>
        !requested ||
        item.id === requested ||
        item.name.toLowerCase().includes(requested),
    );
    if (!board)
      throw new HttpError(
        404,
        "board_not_found",
        "I could not find that board.",
      );
    return modal(`card_add:${board.id}`, "Add a card", [
      { id: "title", label: "Card title" },
      { id: "notes", label: "Notes", style: 2, required: false },
      {
        id: "people",
        label: "People names, separated by commas",
        required: false,
      },
      {
        id: "importance",
        label: "Importance: none, low, medium, high, urgent",
        required: false,
      },
      { id: "when", label: "When: YYYY-MM-DD", required: false },
    ]);
  }

  const card = findCard(data, option(sub.options, "key"));
  if (sub.name === "open") return cardMessage(data, card, origin);
  if (sub.name === "update") {
    const title = option(sub.options, "title");
    const notes = option(sub.options, "notes");
    const tagNames = String(option(sub.options, "tags") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const importance = option(sub.options, "importance");
    const when = option(sub.options, "when");
    const waiting = option(sub.options, "waiting");
    const waitingReason = option(sub.options, "waiting_reason");
    const board = data.boards.find((item) => item.id === card.boardId);
    const requestedTagIds = tagNames.length
      ? data.tags
          .filter(
            (tag) =>
              tag.groupId === board?.groupId &&
              tagNames.includes(tag.name.toLowerCase()),
          )
          .map((tag) => tag.id)
      : undefined;
    await updateCard(viewer, card.id, {
      expectedVersion: card.version,
      ...(title ? { title: String(title) } : {}),
      ...(notes !== undefined ? { notes: String(notes) } : {}),
      ...(requestedTagIds ? { tagIds: requestedTagIds } : {}),
      ...(importance ? { importance: String(importance) as Importance } : {}),
      ...(when ? { when: String(when) } : {}),
      ...(typeof waiting === "boolean" ? { blocked: waiting } : {}),
      ...(waitingReason !== undefined
        ? { blockedReason: String(waitingReason) || null }
        : {}),
    });
  } else if (sub.name === "move") {
    const columnName = String(
      option(sub.options, "column") ?? "",
    ).toLowerCase();
    const destination = data.columns.find(
      (column) =>
        column.boardId === card.boardId &&
        column.name.toLowerCase() === columnName,
    );
    if (!destination)
      throw new HttpError(
        400,
        "column_not_found",
        "I could not find that column on this board.",
      );
    await moveCard(viewer, card.id, {
      columnId: destination.id,
      expectedVersion: card.version,
    });
  } else if (sub.name === "people") {
    const discordId = String(option(sub.options, "person") ?? "");
    const action = String(option(sub.options, "action") ?? "add");
    const person = personForDiscord(data, discordId);
    if (!person)
      throw new HttpError(
        404,
        "person_not_linked",
        "That person has not opened The Board yet.",
      );
    await updateCard(viewer, card.id, {
      expectedVersion: card.version,
      personIds:
        action === "remove"
          ? card.personIds.filter((id) => id !== person.id)
          : [...new Set([...card.personIds, person.id])],
    });
  } else if (sub.name === "note") {
    await addComment(
      viewer,
      card.id,
      String(option(sub.options, "text") ?? ""),
    );
  } else if (sub.name === "checklist") {
    const action = String(option(sub.options, "action") ?? "view");
    const itemValue = String(option(sub.options, "item") ?? "").trim();
    if (action === "view") {
      const lines = card.checklist.map(
        (item, index) =>
          `${item.complete ? "✅" : "⬜"} ${index + 1}. ${item.text}`,
      );
      return ephemeral(
        lines.length
          ? `**${card.key} checklist**\n${lines.join("\n")}`
          : `${card.key} has no checklist items yet.`,
      );
    }
    if (action === "add") {
      await addChecklistItem(viewer, card.id, itemValue);
    } else {
      const numericIndex = Number(itemValue) - 1;
      const item = card.checklist.find(
        (candidate, index) =>
          candidate.id === itemValue ||
          index === numericIndex ||
          candidate.text.toLowerCase() === itemValue.toLowerCase(),
      );
      if (!item)
        throw new HttpError(
          404,
          "checklist_item_not_found",
          "I could not find that checklist item.",
        );
      await setChecklistItem(viewer, card.id, item.id, action === "complete");
    }
  } else if (sub.name === "link") {
    await addGitHubLink(
      viewer,
      card.id,
      String(option(sub.options, "url") ?? ""),
    );
  } else {
    return ephemeral("That card action is not available yet.");
  }
  const refreshed = await loadDashboard(viewer);
  return cardMessage(
    refreshed,
    refreshed.cards.find((item) => item.id === card.id) ?? card,
    origin,
  );
}

async function handleComponent(
  interaction: DiscordInteraction,
  viewer: Person,
  data: DashboardData,
  origin: string,
) {
  const [action, cardId] = (interaction.data?.custom_id ?? "").split(":");
  const card = data.cards.find((item) => item.id === cardId);
  if (!card) throw new HttpError(404, "card_not_found", "That card is gone.");
  if (action === "move") {
    return modal(`move:${card.id}`, "Move card", [
      { id: "column", label: "Column name" },
    ]);
  }
  if (action === "note") {
    return modal(`note:${card.id}`, "Add a note", [
      { id: "note", label: "Note", style: 2 },
    ]);
  }
  if (action === "join") {
    await updateCard(viewer, card.id, {
      expectedVersion: card.version,
      personIds: [...new Set([...card.personIds, viewer.id])],
    });
  } else if (action === "done") {
    const doneColumn = data.columns.find(
      (column) =>
        column.boardId === card.boardId && column.name.toLowerCase() === "done",
    );
    if (!doneColumn)
      throw new HttpError(
        400,
        "done_column_missing",
        "This board does not have a Done column.",
      );
    await moveCard(viewer, card.id, {
      columnId: doneColumn.id,
      expectedVersion: card.version,
    });
  } else if (action === "waiting") {
    await updateCard(viewer, card.id, {
      expectedVersion: card.version,
      blocked: !card.blocked,
    });
  }
  const refreshed = await loadDashboard(viewer);
  return cardMessage(
    refreshed,
    refreshed.cards.find((item) => item.id === card.id) ?? card,
    origin,
  );
}

async function handleModal(
  interaction: DiscordInteraction,
  viewer: Person,
  data: DashboardData,
  origin: string,
) {
  const values = modalValues(interaction);
  const customId = interaction.data?.custom_id ?? "";
  if (customId.startsWith("note:") || customId.startsWith("move:")) {
    const [action, cardId] = customId.split(":");
    const card = data.cards.find((item) => item.id === cardId);
    if (!card) throw new HttpError(404, "card_not_found", "That card is gone.");
    if (action === "note") {
      await addComment(viewer, card.id, values.note ?? "");
    } else {
      const columnName = (values.column ?? "").toLowerCase();
      const column = data.columns.find(
        (item) =>
          item.boardId === card.boardId &&
          item.name.toLowerCase() === columnName,
      );
      if (!column)
        throw new HttpError(
          404,
          "column_not_found",
          "I could not find that column on this board.",
        );
      await moveCard(viewer, card.id, {
        columnId: column.id,
        expectedVersion: card.version,
      });
    }
    const refreshed = await loadDashboard(viewer);
    return cardMessage(
      refreshed,
      refreshed.cards.find((item) => item.id === card.id) ?? card,
      origin,
    );
  }
  const requestedBoardId = customId.startsWith("card_add:")
    ? customId.split(":")[1]
    : undefined;
  const board =
    data.boards.find((item) => item.id === requestedBoardId) ?? data.boards[0];
  if (!board)
    throw new HttpError(
      404,
      "board_not_found",
      "There are no boards available yet.",
    );
  const firstColumn = data.columns
    .filter((column) => column.boardId === board.id)
    .sort((a, b) => a.rank - b.rank)[0];
  if (!firstColumn)
    throw new HttpError(400, "column_missing", "That board has no columns.");
  const created = await createCard(viewer, {
    boardId: board.id,
    columnId: firstColumn.id,
    title: values.title ?? "Discord follow-up",
    notes: values.notes,
    importance: (["low", "medium", "high", "urgent"] as const).includes(
      values.importance as "low" | "medium" | "high" | "urgent",
    )
      ? (values.importance as Importance)
      : "none",
    when: /^\d{4}-\d{2}-\d{2}$/.test(values.when ?? "") ? values.when : null,
    personIds: [
      viewer.id,
      ...data.people
        .filter((person) =>
          (values.people ?? "")
            .split(",")
            .map((value) =>
              value
                .trim()
                .replace(/[<@!>]/g, "")
                .toLowerCase(),
            )
            .some(
              (value) =>
                value === person.name.toLowerCase() ||
                value === person.discordId,
            ),
        )
        .map((person) => person.id),
    ],
  });
  const refreshed = await loadDashboard(viewer);
  const card = refreshed.cards.find((item) => item.id === created.id);
  return card
    ? cardMessage(refreshed, card, origin)
    : ephemeral("Added the card to The Board.");
}

function shouldDefer(interaction: DiscordInteraction) {
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data?.name === "Add to The Board") return false;
    return !(
      interaction.data?.name === "card" &&
      interaction.data.options?.[0]?.name === "add"
    );
  }
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const action = interaction.data?.custom_id?.split(":")[0];
    return action !== "move" && action !== "note";
  }
  return interaction.type === InteractionType.MODAL_SUBMIT;
}

async function replaceDeferredResponse(
  interaction: DiscordInteraction,
  response: InteractionResponse,
) {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId || !interaction.token) {
    throw new Error("Discord follow-up delivery is not configured.");
  }
  const data = { ...((response.data ?? {}) as Record<string, unknown>) };
  delete data.flags;
  const result = await fetch(
    `https://discord.com/api/v10/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interaction.token)}/messages/@original`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!result.ok) {
    throw new Error(`Discord follow-up failed with ${result.status}.`);
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";
  const rawBody = await request.text();

  if (!(await verifyDiscordRequest(rawBody, signature, timestamp, publicKey))) {
    return new Response("Bad request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  const configuredGuild = process.env.DISCORD_GUILD_ID;
  if (configuredGuild && interaction.guild_id !== configuredGuild) {
    return Response.json(
      ephemeral("This app belongs to a different Discord server."),
    );
  }

  const processInteraction = async () => {
    try {
      if (isDemoMode()) await ensureDemoData();
      const replay = await claimInteraction(interaction.id);
      if (replay) return replay;
      const discordId = interaction.member?.user?.id ?? interaction.user?.id;
      if (!discordId)
        throw new HttpError(
          401,
          "discord_user_missing",
          "Discord did not include your identity.",
        );
      const viewer = await getDiscordViewer(discordId);
      const data = await loadDashboard(viewer);
      const origin = new URL(request.url).origin;
      let response: InteractionResponse;
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        response = await handleCommand(interaction, viewer, data, origin);
      } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        response = await handleComponent(interaction, viewer, data, origin);
      } else if (interaction.type === InteractionType.MODAL_SUBMIT) {
        response = await handleModal(interaction, viewer, data, origin);
      } else {
        response = ephemeral("That interaction is not supported yet.");
      }
      return await saveInteraction(interaction.id, response);
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : "Something went sideways. Nothing was changed.";
      console.error(
        JSON.stringify({
          level: "error",
          event: "discord.interaction_failed",
          interactionId: interaction.id,
          message,
        }),
      );
      return ephemeral(message);
    }
  };

  if (
    shouldDefer(interaction) &&
    interaction.token &&
    process.env.DISCORD_APPLICATION_ID
  ) {
    waitUntil(
      processInteraction()
        .then((response) => replaceDeferredResponse(interaction, response))
        .catch((error) =>
          console.error(
            JSON.stringify({
              level: "error",
              event: "discord.followup_failed",
              interactionId: interaction.id,
              message: error instanceof Error ? error.message : "Unknown error",
            }),
          ),
        ),
    );
    return Response.json(deferredEphemeral());
  }

  return Response.json(await processInteraction());
}
