const origin = process.env.PUBLIC_ORIGIN?.trim();
if (!origin) throw new Error("PUBLIC_ORIGIN is required for smoke tests.");

const base = new URL(origin);
if (
  base.protocol !== "https:" ||
  base.pathname !== "/" ||
  base.search ||
  base.hash ||
  base.username ||
  base.password
) {
  throw new Error("PUBLIC_ORIGIN must be an HTTPS origin with no path.");
}

async function check(path) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "rgboo-deploy-smoke/1.0" },
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
  const body = await response.json();
  if (body?.status !== "ok")
    throw new Error(`${path} returned an invalid body.`);
}

let lastError;
for (let attempt = 1; attempt <= 6; attempt += 1) {
  try {
    await check("/api/health/live");
    await check("/api/health/ready");
    console.log(`Smoke tests passed for ${base.origin}.`);
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < 6)
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
  }
}
if (lastError) throw lastError;
