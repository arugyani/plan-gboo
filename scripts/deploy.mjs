import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { readDeploySecrets } from "./deploy-config.mjs";

const environment = process.argv[2];
if (!new Set(["staging", "production"]).has(environment)) {
  throw new Error("Choose either staging or production.");
}

const secrets = readDeploySecrets(process.env);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "rgboo-deploy-"));
const secretsFile = join(temporaryDirectory, "secrets.json");
const executable = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

try {
  await writeFile(secretsFile, `${JSON.stringify(secrets)}\n`, { mode: 0o600 });
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(
      executable,
      [
        "deploy",
        "--config",
        "wrangler.jsonc",
        "--env",
        environment,
        "--secrets-file",
        secretsFile,
      ],
      { stdio: "inherit", env: process.env },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
