interface JobsEnv {
  DB: D1Database;
  APP_ENV: string;
}

interface OutboxRow {
  id: string;
  kind: string;
  payload: string;
  attempts: number;
}

interface DiscordPayload {
  channelId?: string;
  userId?: string;
  content?: string;
}

interface RecapGroup {
  id: string;
  name: string;
  channelId: string;
  recapHourUtc: number;
}

interface RecapCount {
  boardName: string;
  columnName: string;
  cardCount: number;
}

export interface DueCard {
  cardId: string;
  key: string;
  title: string;
  when: string;
  userId: string;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
}

export const retryDelayMinutes = (attempts: number) =>
  Math.min(60, 2 ** attempts);

export const recapDedupeKey = (groupId: string, date: string) =>
  `recap:${groupId}:${date}`;

async function sendDiscord(env: JobsEnv, payload: DiscordPayload) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !payload.content)
    throw new Error("Discord delivery is not configured");

  let channelId = payload.channelId;
  if (!channelId && payload.userId) {
    const dm = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ recipient_id: payload.userId }),
    });
    if (!dm.ok) throw new Error(`Discord DM channel failed with ${dm.status}`);
    const body = (await dm.json()) as { id?: string };
    channelId = body.id;
  }
  if (!channelId) throw new Error("Discord channel is missing");

  const response = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content: payload.content,
        allowed_mentions: { parse: [] },
      }),
    },
  );
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `Discord send failed with ${response.status}${retryAfter ? `; retry after ${retryAfter}` : ""}`,
    );
  }
}

async function processOutbox(env: JobsEnv) {
  const now = new Date().toISOString();
  const abandonedBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const rows = await env.DB.prepare(
    `SELECT id, kind, payload, attempts
     FROM outbox
     WHERE (status IN ('pending', 'failed') AND available_at <= ?)
        OR (status = 'processing' AND locked_at <= ?)
     ORDER BY available_at ASC
     LIMIT 10`,
  )
    .bind(now, abandonedBefore)
    .all<OutboxRow>();

  for (const row of rows.results) {
    const claimed = await env.DB.prepare(
      `UPDATE outbox
       SET status = 'processing', locked_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (
         status IN ('pending', 'failed')
         OR (status = 'processing' AND locked_at <= ?)
       )`,
    )
      .bind(now, row.id, abandonedBefore)
      .run();
    if (!claimed.meta.changes) continue;

    try {
      const payload = JSON.parse(row.payload) as DiscordPayload;
      if (row.kind.startsWith("discord_")) await sendDiscord(env, payload);
      await env.DB.prepare(
        `UPDATE outbox SET status = 'sent', attempts = attempts + 1,
         locked_at = NULL, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
        .bind(row.id)
        .run();
    } catch (error) {
      const attempts = row.attempts + 1;
      const delayMinutes = retryDelayMinutes(attempts);
      const next = new Date(Date.now() + delayMinutes * 60_000).toISOString();
      await env.DB.prepare(
        `UPDATE outbox SET status = 'failed', attempts = ?, available_at = ?,
         locked_at = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
        .bind(
          attempts,
          next,
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown delivery error",
          row.id,
        )
        .run();
    }
  }
  return rows.results.length;
}

async function reconcileGuild(env: JobsEnv) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !token) return 0;
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const people = await env.DB.prepare(
    `SELECT id, discord_id AS discordId
     FROM user
     WHERE active = 1 AND discord_id IS NOT NULL
       AND (guild_verified_at IS NULL OR guild_verified_at < ?)
     LIMIT 5`,
  )
    .bind(staleBefore)
    .all<{ id: string; discordId: string }>();

  for (const person of people.results) {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(person.discordId)}`,
      { headers: { authorization: `Bot ${token}` } },
    );
    if (response.status === 404) {
      await env.DB.prepare(
        "UPDATE user SET active = 0, updated_at = ? WHERE id = ?",
      )
        .bind(Date.now(), person.id)
        .run();
    } else if (response.ok) {
      await env.DB.prepare(
        "UPDATE user SET guild_verified_at = ?, updated_at = ? WHERE id = ?",
      )
        .bind(new Date().toISOString(), Date.now(), person.id)
        .run();
    }
  }
  return people.results.length;
}

async function scheduleRecaps(env: JobsEnv) {
  const hour = new Date().getUTCHours();
  const today = new Date().toISOString().slice(0, 10);
  const groups = await env.DB.prepare(
    `SELECT id, name, discord_channel_id AS channelId,
            recap_hour_utc AS recapHourUtc
     FROM groups
     WHERE archived_at IS NULL
       AND recap_enabled = 1
       AND discord_channel_id IS NOT NULL
       AND recap_hour_utc <= ?
       AND (last_recap_at IS NULL OR substr(last_recap_at, 1, 10) < ?)
     ORDER BY name ASC
     LIMIT 2`,
  )
    .bind(hour, today)
    .all<RecapGroup>();

  for (const group of groups.results) {
    const counts = await env.DB.prepare(
      `SELECT b.name AS boardName, c.name AS columnName,
              COUNT(card.id) AS cardCount
       FROM boards b
       JOIN columns c ON c.board_id = b.id
       LEFT JOIN cards card
         ON card.board_id = b.id
        AND card.column_id = c.id
        AND card.archived_at IS NULL
       WHERE b.group_id = ? AND b.archived_at IS NULL
       GROUP BY b.id, c.id
       ORDER BY b.name ASC, c.rank ASC`,
    )
      .bind(group.id)
      .all<RecapCount>();
    const boardLines = new Map<string, string[]>();
    for (const count of counts.results) {
      const values = boardLines.get(count.boardName) ?? [];
      values.push(`${count.columnName}: ${count.cardCount}`);
      boardLines.set(count.boardName, values);
    }
    const content = [
      `**${group.name} · daily recap**`,
      ...Array.from(
        boardLines,
        ([boardName, values]) => `**${boardName}:** ${values.join(" · ")}`,
      ),
    ]
      .join("\n")
      .slice(0, 1_900);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO outbox
           (id, kind, dedupe_key, payload, status, attempts, available_at,
            created_at, updated_at)
         VALUES (?, 'discord_recap', ?, ?, 'pending', 0, ?, ?, ?)
         ON CONFLICT(dedupe_key) DO NOTHING`,
      ).bind(
        crypto.randomUUID(),
        recapDedupeKey(group.id, today),
        JSON.stringify({ channelId: group.channelId, content }),
        now,
        now,
        now,
      ),
      env.DB.prepare(
        "UPDATE groups SET last_recap_at = ?, updated_at = ? WHERE id = ?",
      ).bind(now, now, group.id),
    ]);
  }
  return groups.results.length;
}

export function isQuietTime(reminder: DueCard, now: Date) {
  if (!reminder.quietStart || !reminder.quietEnd) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: reminder.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
    const current = `${hour}:${minute}`;
    return reminder.quietStart < reminder.quietEnd
      ? current >= reminder.quietStart && current < reminder.quietEnd
      : current >= reminder.quietStart || current < reminder.quietEnd;
  } catch {
    return false;
  }
}

async function scheduleDueSoon(env: JobsEnv) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrowDate = new Date(now);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const reminders = await env.DB.prepare(
    `SELECT card.id AS cardId, card.key, card.title, card.when,
            u.discord_id AS userId, np.quiet_start AS quietStart,
            np.quiet_end AS quietEnd, np.timezone
     FROM cards card
     JOIN card_people cp ON cp.card_id = card.id
     JOIN user u ON u.id = cp.user_id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE card.archived_at IS NULL
       AND card.when BETWEEN ? AND ?
       AND u.active = 1
       AND u.discord_id IS NOT NULL
       AND (np.due_soon IS NULL OR np.due_soon = 1)
     ORDER BY card.when ASC, card.key ASC
     LIMIT 20`,
  )
    .bind(today, tomorrow)
    .all<DueCard>();

  let scheduled = 0;
  for (const reminder of reminders.results) {
    if (isQuietTime(reminder, now)) continue;
    const relative = reminder.when === today ? "today" : "tomorrow";
    const result = await env.DB.prepare(
      `INSERT INTO outbox
         (id, kind, dedupe_key, payload, status, attempts, available_at,
          created_at, updated_at)
       VALUES (?, 'discord_due_soon', ?, ?, 'pending', 0, ?, ?, ?)
       ON CONFLICT(dedupe_key) DO NOTHING`,
    )
      .bind(
        crypto.randomUUID(),
        `due:${reminder.cardId}:${reminder.userId}:${reminder.when}`,
        JSON.stringify({
          userId: reminder.userId,
          content: `🎃 **${reminder.key} · ${reminder.title}** is coming up ${relative}.`,
        }),
        now.toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    scheduled += result.meta.changes;
  }
  return scheduled;
}

async function heartbeat() {
  const url = process.env.MONITOR_HEARTBEAT_URL;
  if (!url) return;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok)
    throw new Error(`Monitoring heartbeat failed with ${response.status}`);
}

async function run(env: JobsEnv) {
  const startedAt = Date.now();
  const [outboxCount, peopleCount, recapCount, reminderCount] =
    await Promise.all([
      processOutbox(env),
      reconcileGuild(env),
      scheduleRecaps(env),
      scheduleDueSoon(env),
    ]);
  await heartbeat();
  console.log(
    JSON.stringify({
      level: "info",
      event: "jobs.completed",
      environment: env.APP_ENV,
      outboxCount,
      peopleCount,
      recapCount,
      reminderCount,
      durationMs: Date.now() - startedAt,
    }),
  );
}

export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(
    _event: ScheduledController,
    env: JobsEnv,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(run(env));
  },
} satisfies ExportedHandler<JobsEnv>;
