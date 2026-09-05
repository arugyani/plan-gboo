import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

function environment(overrides: Record<string, unknown> = {}) {
  return {
    APP_ENV: "local",
    ASSETS: { fetch: vi.fn().mockResolvedValue(new Response("asset")) },
    AUTH_SESSION_SECRET: "a-long-random-session-secret-for-tests-only",
    BOT_API_ORIGIN: "https://bot.example.com",
    BOT_API_TOKEN: "service-token",
    BOT_DISCORD_GUILD_ID: "987654321098765432",
    BOT_DISCORD_USER_ID: "",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "discord-secret",
    PUBLIC_ORIGIN: "https://board.example.com",
    ...overrides,
  } as unknown as Env;
}

afterEach(() => vi.unstubAllGlobals());

describe("board Worker", () => {
  it("reports liveness without calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://board.example.com/api/health/live"),
      environment(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks backend readiness", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Healthy"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://board.example.com/api/health/ready"),
      environment(),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const input = fetchMock.mock.calls[0]?.[0];
    const inputUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input?.url;
    expect(inputUrl).toBe("https://bot.example.com/health");
  });

  it("proxies API calls with only trusted identity headers", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ cards: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://board.example.com/api/dashboard", {
        headers: {
          authorization: "Bearer attacker-token",
          cookie: "private-browser-cookie=value",
          "x-discord-user-id": "attacker-user-id",
        },
      }),
      environment({ BOT_DISCORD_USER_ID: "123456789012345678" }),
    );

    expect(response.status).toBe(200);
    const proxied = fetchMock.mock.calls[0]?.[0];
    expect(proxied).toBeInstanceOf(Request);
    if (!(proxied instanceof Request))
      throw new Error("Expected a proxied Request");
    expect(proxied.url).toBe("https://bot.example.com/api/dashboard");
    expect(proxied.headers.get("authorization")).toBe("Bearer service-token");
    expect(proxied.headers.get("cookie")).toBeNull();
    expect(proxied.headers.get("x-discord-user-id")).toBe("123456789012345678");
    expect(proxied.headers.get("x-discord-guild-id")).toBe(
      "987654321098765432",
    );
  });

  it("requires an explicit Discord identity when there is no session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://board.example.com/api/dashboard"),
      environment({
        BOT_DISCORD_USER_ID: "",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "not_authenticated",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the SPA with browser security headers", async () => {
    const assets = {
      fetch: vi.fn().mockResolvedValue(
        new Response("<html></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    };
    const response = await worker.fetch(
      new Request("https://board.example.com/"),
      environment({ ASSETS: assets as unknown as Fetcher }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });
});
