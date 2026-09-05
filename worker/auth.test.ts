import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAuth, readSession } from "./auth";

const env = {
  APP_ENV: "production",
  PUBLIC_ORIGIN: "https://board.example.com",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "discord-client-secret",
  AUTH_SESSION_SECRET: "a-long-random-session-secret-for-tests-only",
} as Pick<
  Env,
  | "APP_ENV"
  | "PUBLIC_ORIGIN"
  | "DISCORD_CLIENT_ID"
  | "DISCORD_CLIENT_SECRET"
  | "AUTH_SESSION_SECRET"
>;

function cookiePair(header: string, name: string) {
  const match = header.match(new RegExp(`(?:^|, )${name}=([^;]+)`));
  if (!match) throw new Error(`${name} was not set`);
  return `${name}=${match[1]}`;
}

async function jsonRecord(response: Response) {
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null)
    throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Discord OAuth", () => {
  it("creates and validates a signed session", async () => {
    const signIn = await handleAuth(
      new Request("https://board.example.com/api/auth/sign-in", {
        method: "POST",
      }),
      env,
    );
    expect(signIn.status).toBe(200);
    const url = (await jsonRecord(signIn)).url;
    if (typeof url !== "string") throw new Error("Expected a sign-in URL");
    const authorize = new URL(url);
    expect(authorize.origin).toBe("https://discord.com");
    expect(authorize.searchParams.get("scope")).toBe("identify");
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "https://board.example.com/api/auth/callback",
    );

    const state = authorize.searchParams.get("state");
    const stateCookie = cookiePair(
      signIn.headers.get("set-cookie") ?? "",
      "__Host-rgboo_oauth_state",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            access_token: "discord-token",
            token_type: "Bearer",
          }),
        )
        .mockResolvedValueOnce(Response.json({ id: "123456789012345678" })),
    );

    const callback = await handleAuth(
      new Request(
        `https://board.example.com/api/auth/callback?code=oauth-code&state=${state}`,
        { headers: { cookie: stateCookie } },
      ),
      env,
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("https://board.example.com/");
    const sessionCookie = cookiePair(
      callback.headers.get("set-cookie") ?? "",
      "__Host-rgboo_session",
    );
    const session = await readSession(
      new Request("https://board.example.com/api/dashboard", {
        headers: { cookie: sessionCookie },
      }),
      env,
    );
    expect(session?.userId).toBe("123456789012345678");
  });

  it("rejects callbacks that are not tied to the initiating browser", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleAuth(
      new Request(
        "https://board.example.com/api/auth/callback?code=oauth-code&state=wrong",
        { headers: { cookie: "__Host-rgboo_oauth_state=expected" } },
      ),
      env,
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a signed session after it has been changed", async () => {
    const signIn = await handleAuth(
      new Request("https://board.example.com/api/auth/sign-in", {
        method: "POST",
      }),
      env,
    );
    const url = (await jsonRecord(signIn)).url;
    if (typeof url !== "string") throw new Error("Expected a sign-in URL");
    const state = new URL(url).searchParams.get("state");
    const stateCookie = cookiePair(
      signIn.headers.get("set-cookie") ?? "",
      "__Host-rgboo_oauth_state",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            access_token: "discord-token",
            token_type: "Bearer",
          }),
        )
        .mockResolvedValueOnce(Response.json({ id: "123456789012345678" })),
    );
    const callback = await handleAuth(
      new Request(
        `https://board.example.com/api/auth/callback?code=oauth-code&state=${state}`,
        { headers: { cookie: stateCookie } },
      ),
      env,
    );
    const sessionCookie = cookiePair(
      callback.headers.get("set-cookie") ?? "",
      "__Host-rgboo_session",
    );
    const tampered = `${sessionCookie.slice(0, -1)}x`;
    await expect(
      readSession(
        new Request("https://board.example.com/api/dashboard", {
          headers: { cookie: tampered },
        }),
        env,
      ),
    ).resolves.toBeNull();
  });

  it("expires a signed session after seven days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    const signIn = await handleAuth(
      new Request("https://board.example.com/api/auth/sign-in", {
        method: "POST",
      }),
      env,
    );
    const url = (await jsonRecord(signIn)).url;
    if (typeof url !== "string") throw new Error("Expected a sign-in URL");
    const state = new URL(url).searchParams.get("state");
    const stateCookie = cookiePair(
      signIn.headers.get("set-cookie") ?? "",
      "__Host-rgboo_oauth_state",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            access_token: "discord-token",
            token_type: "Bearer",
          }),
        )
        .mockResolvedValueOnce(Response.json({ id: "123456789012345678" })),
    );
    const callback = await handleAuth(
      new Request(
        `https://board.example.com/api/auth/callback?code=oauth-code&state=${state}`,
        { headers: { cookie: stateCookie } },
      ),
      env,
    );
    const sessionCookie = cookiePair(
      callback.headers.get("set-cookie") ?? "",
      "__Host-rgboo_session",
    );

    vi.setSystemTime(new Date("2026-09-12T12:00:01Z"));
    await expect(
      readSession(
        new Request("https://board.example.com/api/dashboard", {
          headers: { cookie: sessionCookie },
        }),
        env,
      ),
    ).resolves.toBeNull();
  });

  it("clears the signed session on sign-out", async () => {
    const response = await handleAuth(
      new Request("https://board.example.com/api/auth/sign-out", {
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-rgboo_session=",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
