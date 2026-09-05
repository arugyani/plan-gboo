const DISCORD_API = "https://discord.com/api/v10";
const SESSION_COOKIE = "__Host-rgboo_session";
const OAUTH_STATE_COOKIE = "__Host-rgboo_oauth_state";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const STATE_SECONDS = 60 * 10;

type AuthEnv = Pick<
  Env,
  | "APP_ENV"
  | "AUTH_SESSION_SECRET"
  | "DISCORD_CLIENT_ID"
  | "DISCORD_CLIENT_SECRET"
  | "PUBLIC_ORIGIN"
>;

type SessionPayload = {
  version: 1;
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

export class AuthConfigurationError extends Error {}

function required(value: string | undefined, name: string) {
  if (!value?.trim())
    throw new AuthConfigurationError(`${name} is not configured.`);
  return value.trim();
}

function requiredSessionSecret(value: string | undefined) {
  const secret = required(value, "AUTH_SESSION_SECRET");
  if (new TextEncoder().encode(secret).byteLength < 32)
    throw new AuthConfigurationError(
      "AUTH_SESSION_SECRET must contain at least 32 bytes.",
    );
  return secret;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeText(value: string) {
  return encodeBytes(new TextEncoder().encode(value));
}

function decodeText(value: string) {
  return new TextDecoder().decode(decodeBytes(value));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBytes(bytes);
}

async function constantTimeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < leftBytes.length; index += 1)
    difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

async function hmac(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
}

async function verifyHmac(message: string, signature: string, secret: string) {
  let bytes: Uint8Array;
  try {
    bytes = decodeBytes(signature);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(message),
  );
}

function readCookies(request: Request) {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    result.set(
      part.slice(0, separator).trim(),
      part.slice(separator + 1).trim(),
    );
  }
  return result;
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return Response.json(body, { ...init, headers });
}

function configuredOrigin(request: Request, env: AuthEnv) {
  const requestOrigin = new URL(request.url).origin;
  if (!env.PUBLIC_ORIGIN?.trim()) return requestOrigin;
  const configured = new URL(env.PUBLIC_ORIGIN).origin;
  if (env.APP_ENV !== "local" && configured !== requestOrigin)
    throw new AuthConfigurationError(
      "PUBLIC_ORIGIN does not match the address serving this request.",
    );
  return configured;
}

function authCallbackUrl(request: Request, env: AuthEnv) {
  return `${configuredOrigin(request, env)}/api/auth/callback`;
}

async function createSession(userId: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    version: 1,
    userId,
    issuedAt,
    expiresAt: issuedAt + SESSION_SECONDS,
  };
  const encoded = encodeText(JSON.stringify(payload));
  return `v1.${encoded}.${encodeBytes(await hmac(`v1.${encoded}`, secret))}`;
}

export async function readSession(request: Request, env: AuthEnv) {
  if (!env.AUTH_SESSION_SECRET) return null;
  const sessionSecret = requiredSessionSecret(env.AUTH_SESSION_SECRET);
  const token = readCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const [version, encoded, signature, extra] = token.split(".");
  if (version !== "v1" || !encoded || !signature || extra) return null;
  if (!(await verifyHmac(`${version}.${encoded}`, signature, sessionSecret)))
    return null;

  try {
    const payload = JSON.parse(decodeText(encoded)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.version !== 1 ||
      !/^\d{5,24}$/u.test(payload.userId) ||
      !Number.isSafeInteger(payload.issuedAt) ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.issuedAt > now + 60 ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt > SESSION_SECONDS
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export async function handleAuth(request: Request, env: AuthEnv) {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/sign-in") {
    if (request.method !== "POST")
      return json(
        { code: "method_not_allowed", message: "Use POST." },
        { status: 405 },
      );
    const clientId = required(env.DISCORD_CLIENT_ID, "DISCORD_CLIENT_ID");
    required(env.DISCORD_CLIENT_SECRET, "DISCORD_CLIENT_SECRET");
    requiredSessionSecret(env.AUTH_SESSION_SECRET);
    const state = randomToken();
    const authorize = new URL("https://discord.com/oauth2/authorize");
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "identify",
      state,
      redirect_uri: authCallbackUrl(request, env),
    }).toString();
    const response = json({ url: authorize.toString() });
    response.headers.append(
      "set-cookie",
      cookie(OAUTH_STATE_COOKIE, state, STATE_SECONDS),
    );
    return response;
  }

  if (url.pathname === "/api/auth/callback") {
    if (request.method !== "GET")
      return json(
        { code: "method_not_allowed", message: "Use GET." },
        { status: 405 },
      );
    const returnedState = url.searchParams.get("state") ?? "";
    const expectedState = readCookies(request).get(OAUTH_STATE_COOKIE) ?? "";
    const stateMatches =
      returnedState.length > 0 &&
      expectedState.length > 0 &&
      (await constantTimeEqual(returnedState, expectedState));
    if (!stateMatches)
      return json(
        {
          code: "invalid_oauth_state",
          message: "That sign-in link expired. Please try again.",
        },
        { status: 400 },
      );

    const code = url.searchParams.get("code");
    if (!code)
      return json(
        { code: "oauth_denied", message: "Discord sign-in was cancelled." },
        { status: 400 },
      );

    const clientId = required(env.DISCORD_CLIENT_ID, "DISCORD_CLIENT_ID");
    const clientSecret = required(
      env.DISCORD_CLIENT_SECRET,
      "DISCORD_CLIENT_SECRET",
    );
    const sessionSecret = requiredSessionSecret(env.AUTH_SESSION_SECRET);
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: authCallbackUrl(request, env),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok)
      return json(
        {
          code: "oauth_exchange_failed",
          message: "Discord sign-in could not be completed.",
        },
        { status: 502 },
      );
    const token = record(await tokenResponse.json());
    const accessToken = token?.access_token;
    const tokenType = token?.token_type;
    if (
      typeof accessToken !== "string" ||
      typeof tokenType !== "string" ||
      tokenType.toLowerCase() !== "bearer"
    )
      return json(
        {
          code: "oauth_exchange_failed",
          message: "Discord returned an invalid sign-in response.",
        },
        { status: 502 },
      );

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok)
      return json(
        {
          code: "oauth_profile_failed",
          message: "Discord could not confirm your account.",
        },
        { status: 502 },
      );
    const user = record(await userResponse.json());
    const userId = user?.id;
    if (typeof userId !== "string" || !/^\d{5,24}$/u.test(userId))
      return json(
        {
          code: "oauth_profile_failed",
          message: "Discord returned an invalid account.",
        },
        { status: 502 },
      );

    const response = new Response(null, {
      status: 303,
      headers: { location: `${configuredOrigin(request, env)}/` },
    });
    response.headers.append(
      "set-cookie",
      cookie(
        SESSION_COOKIE,
        await createSession(userId, sessionSecret),
        SESSION_SECONDS,
      ),
    );
    response.headers.append("set-cookie", cookie(OAUTH_STATE_COOKIE, "", 0));
    response.headers.set("cache-control", "no-store");
    return response;
  }

  if (url.pathname === "/api/auth/session") {
    if (request.method !== "GET")
      return json(
        { code: "method_not_allowed", message: "Use GET." },
        { status: 405 },
      );
    const session = await readSession(request, env);
    return json(
      session
        ? { authenticated: true, userId: session.userId }
        : { authenticated: false },
      { status: session ? 200 : 401 },
    );
  }

  if (url.pathname === "/api/auth/sign-out") {
    if (request.method !== "POST")
      return json(
        { code: "method_not_allowed", message: "Use POST." },
        { status: 405 },
      );
    const response = new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
    response.headers.append("set-cookie", cookie(SESSION_COOKIE, "", 0));
    return response;
  }

  return json(
    { code: "not_found", message: "That sign-in route does not exist." },
    { status: 404 },
  );
}
