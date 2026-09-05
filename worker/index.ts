import { AuthConfigurationError, handleAuth, readSession } from "./auth";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function withSecurityHeaders(response: Response, noStore = false) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders))
    headers.set(name, value);
  if (noStore) headers.set("cache-control", "no-store");
  if (headers.get("content-type")?.includes("text/html")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function apiError(status: number, code: string, message: string) {
  return Response.json(
    { code, message, correlationId: crypto.randomUUID() },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function needsBody(method: string) {
  return method !== "GET" && method !== "HEAD";
}

async function proxyBoardApi(request: Request, env: Env) {
  if (!env.BOT_API_TOKEN) {
    return apiError(
      503,
      "api_not_configured",
      "The shared board connection has not been configured yet.",
    );
  }

  const session = await readSession(request, env);
  const userId = session?.userId || env.BOT_DISCORD_USER_ID;
  if (!userId)
    return apiError(
      401,
      "not_authenticated",
      "Sign in with Discord to open The Board.",
    );

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    env.BOT_API_ORIGIN,
  );
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${env.BOT_API_TOKEN}`);
  headers.delete("host");
  headers.delete("cookie");
  headers.delete("x-discord-user-id");
  headers.delete("x-discord-guild-id");
  if (userId) headers.set("x-discord-user-id", userId);
  if (env.BOT_DISCORD_GUILD_ID)
    headers.set("x-discord-guild-id", env.BOT_DISCORD_GUILD_ID);

  return fetch(
    new Request(targetUrl, {
      method: request.method,
      headers,
      body: needsBody(request.method) ? request.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    }),
  );
}

async function health(request: Request, env: Env, ready: boolean) {
  if (!ready)
    return Response.json(
      { status: "ok", environment: env.APP_ENV },
      { headers: { "cache-control": "no-store" } },
    );
  try {
    const response = await fetch(new URL("/health", env.BOT_API_ORIGIN), {
      headers: { "user-agent": "rgboo-board-health/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      return apiError(
        503,
        "backend_not_ready",
        "The board backend is not ready.",
      );
    return Response.json(
      { status: "ok", backend: "ready", environment: env.APP_ENV },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return apiError(
      503,
      "backend_unavailable",
      "The board backend is unavailable.",
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      let response: Response;
      if (url.pathname.startsWith("/api/auth/"))
        response = await handleAuth(request, env);
      else if (url.pathname === "/api/health/live")
        response = await health(request, env, false);
      else if (url.pathname === "/api/health/ready")
        response = await health(request, env, true);
      else if (url.pathname.startsWith("/api/"))
        response = await proxyBoardApi(request, env);
      else response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response, url.pathname.startsWith("/api/"));
    } catch (error) {
      const correlationId = crypto.randomUUID();
      console.error(
        JSON.stringify({
          event: "board_web_request_failed",
          correlationId,
          path: url.pathname,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return withSecurityHeaders(
        Response.json(
          {
            code:
              error instanceof AuthConfigurationError
                ? "auth_not_configured"
                : "board_unavailable",
            message:
              error instanceof AuthConfigurationError
                ? "Discord sign-in has not been configured yet."
                : "The shared board is taking a short break. Try again in a moment.",
            correlationId,
          },
          {
            status: error instanceof AuthConfigurationError ? 503 : 502,
            headers: { ...securityHeaders, "cache-control": "no-store" },
          },
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
