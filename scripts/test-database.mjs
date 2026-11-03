import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Never reads .env or connects to the application's database.
const root = new URL("../", import.meta.url);
const container = `nuxt-note-foundation-test-${process.pid}-${Date.now()}`;
const docker = (args, options = {}) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });
const read = (path) => readFileSync(new URL(path, root), "utf8");
let started = false;
try {
  docker([
    "run",
    "--rm",
    "--detach",
    "--name",
    container,
    "--network",
    "none",
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "--env",
    "POSTGRES_DB=nuxt_note_foundation_test",
    "postgres:17-alpine",
  ]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(
        [
          "exec",
          container,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
          "-d",
          "nuxt_note_foundation_test",
        ],
        { stdio: "ignore" },
      );
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
  const sql = [
    "prisma/migrations/20261103000000_init/migration.sql",
    "tests/database/chat-foundation.sql",
    "tests/database/chat-foundation-assertions.sql",
  ]
    .map(read)
    .join("\n");
  const output = docker(
    [
      "exec",
      "--interactive",
      container,
      "psql",
      "-h",
      "127.0.0.1",
      "-X",
      "-U",
      "postgres",
      "-d",
      "nuxt_note_foundation_test",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
    ],
    { input: sql, cwd: fileURLToPath(root) },
  );
  console.log(output.trim());
} finally {
  if (started) docker(["stop", container], { stdio: "ignore" });
}
