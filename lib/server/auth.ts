import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { account, groupMemberships, user } from "@/db/schema";
import { demoDashboard } from "@/lib/demo-data";
import type { GroupRole, Person } from "@/lib/types";
import { HttpError } from "./errors";

export function isDemoMode() {
  return env.DEMO_MODE === "true";
}

function requiredSecret(
  name: "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "BETTER_AUTH_SECRET",
) {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(
      503,
      "auth_not_configured",
      "Discord sign-in is not configured yet.",
    );
  }
  return value;
}

export function getAuth(origin?: string) {
  const clientId = requiredSecret("DISCORD_CLIENT_ID");
  const clientSecret = requiredSecret("DISCORD_CLIENT_SECRET");
  const secret = requiredSecret("BETTER_AUTH_SECRET");
  const initialAdminDiscordId = process.env.INITIAL_ADMIN_DISCORD_ID ?? "";

  return betterAuth({
    appName: "The Board",
    baseURL: process.env.BETTER_AUTH_URL || origin,
    basePath: "/api/auth",
    secret,
    trustedOrigins: origin ? [origin] : undefined,
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema,
    }),
    socialProviders: {
      discord: {
        clientId,
        clientSecret,
        mapProfileToUser(profile) {
          return {
            discordId: profile.id,
            email: profile.email || `${profile.id}@discord.local`,
          };
        },
      },
    },
    user: {
      additionalFields: {
        discordId: {
          type: "string",
          required: false,
          input: false,
          fieldName: "discordId",
        },
        systemRole: {
          type: "string",
          required: true,
          defaultValue: "member",
          input: false,
          fieldName: "systemRole",
        },
        active: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
          fieldName: "active",
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(candidate) {
            const discordId = String(candidate.discordId ?? candidate.id);
            return {
              data: {
                ...candidate,
                discordId,
                systemRole:
                  initialAdminDiscordId && discordId === initialAdminDiscordId
                    ? "admin"
                    : "member",
                active: true,
              },
            };
          },
        },
      },
    },
    advanced: {
      cookiePrefix: "rgboo_board",
      useSecureCookies: env.APP_ENV !== "local",
    },
    rateLimit: {
      enabled: env.APP_ENV !== "local",
      window: 60,
      max: 100,
    },
  });
}

async function verifyGuildMembership(
  discordId: string,
  verifiedAt: string | null,
) {
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  if (verifiedAt && new Date(verifiedAt).getTime() > sixHoursAgo) return true;

  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !token) {
    throw new HttpError(
      503,
      "guild_check_not_configured",
      "Discord membership checking is not configured yet.",
    );
  }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordId)}`,
    { headers: { authorization: `Bot ${token}` } },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new HttpError(
      503,
      "discord_unavailable",
      "Discord could not confirm membership right now. Try again shortly.",
    );
  }
  return true;
}

export async function getViewer(request: Request): Promise<Person> {
  if (isDemoMode()) return demoDashboard.viewer;

  const auth = getAuth(new URL(request.url).origin);
  const sessionData = await auth.api.getSession({ headers: request.headers });
  if (!sessionData?.user?.id) {
    throw new HttpError(
      401,
      "sign_in_required",
      "Sign in with Discord to continue.",
    );
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.id, sessionData.user.id))
    .limit(1);
  if (!row || !row.active) {
    throw new HttpError(403, "account_inactive", "This account is not active.");
  }

  let discordId = row.discordId;
  if (!discordId) {
    const [discordAccount] = await db
      .select({ accountId: account.accountId })
      .from(account)
      .where(and(eq(account.userId, row.id), eq(account.providerId, "discord")))
      .limit(1);
    discordId = discordAccount?.accountId ?? null;
  }
  if (!discordId) {
    throw new HttpError(
      403,
      "discord_link_missing",
      "Reconnect Discord to continue.",
    );
  }

  const isMember = await verifyGuildMembership(discordId, row.guildVerifiedAt);
  if (!isMember) {
    await db.update(user).set({ active: false }).where(eq(user.id, row.id));
    throw new HttpError(
      403,
      "guild_membership_required",
      "Join the project Discord server before opening The Board.",
    );
  }

  if (
    !row.guildVerifiedAt ||
    Date.now() - new Date(row.guildVerifiedAt).getTime() > 6 * 60 * 60 * 1000
  ) {
    await db
      .update(user)
      .set({ discordId, guildVerifiedAt: new Date().toISOString() })
      .where(eq(user.id, row.id));
  }

  const memberships = await db
    .select()
    .from(groupMemberships)
    .where(eq(groupMemberships.userId, row.id));

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    discordId,
    systemRole: row.systemRole,
    active: row.active,
    groupRoles: Object.fromEntries(
      memberships.map((membership) => [
        membership.groupId,
        membership.role as GroupRole,
      ]),
    ),
  };
}

export async function getDiscordViewer(discordId: string): Promise<Person> {
  if (isDemoMode()) {
    const person = demoDashboard.people.find(
      (candidate) => candidate.discordId === discordId,
    );
    if (!person)
      throw new HttpError(
        403,
        "person_not_linked",
        "Open The Board once to link your Discord account.",
      );
    return person;
  }

  const db = getDb();
  let [row] = await db
    .select()
    .from(user)
    .where(eq(user.discordId, discordId))
    .limit(1);
  if (!row) {
    const [discordAccount] = await db
      .select({ userId: account.userId })
      .from(account)
      .where(
        and(
          eq(account.providerId, "discord"),
          eq(account.accountId, discordId),
        ),
      )
      .limit(1);
    if (discordAccount) {
      [row] = await db
        .select()
        .from(user)
        .where(eq(user.id, discordAccount.userId))
        .limit(1);
    }
  }
  if (!row || !row.active) {
    throw new HttpError(
      403,
      "person_not_linked",
      "Open The Board once to link your Discord account.",
    );
  }

  const isMember = await verifyGuildMembership(discordId, row.guildVerifiedAt);
  if (!isMember) {
    await db.update(user).set({ active: false }).where(eq(user.id, row.id));
    throw new HttpError(
      403,
      "guild_membership_required",
      "This command is only available in the project server.",
    );
  }
  const memberships = await db
    .select()
    .from(groupMemberships)
    .where(eq(groupMemberships.userId, row.id));
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    discordId,
    systemRole: row.systemRole,
    active: row.active,
    groupRoles: Object.fromEntries(
      memberships.map((membership) => [
        membership.groupId,
        membership.role as GroupRole,
      ]),
    ),
  };
}
