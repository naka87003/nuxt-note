import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startTestDatabase } from "./lib/test-database.mjs";

const root = new URL("../", import.meta.url);
let database;
let runner;
try {
  database = await startTestDatabase({
    name: `nuxt-note-integration-test-${process.pid}-${Date.now()}`,
    database: "nuxt_note_move_test",
    onStop: () => runner?.kill("SIGTERM"),
  });
  // Keep the event loop available so signals can clean up during tests.
  runner = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("node_modules/vitest/vitest.mjs", root)),
      "run",
      "--config",
      "vitest.integration.config.ts",
      ...process.argv.slice(2),
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        NUXT_NOTE_MOVE_TEST_DATABASE_URL: database.url,
      },
    },
  );
  await new Promise((resolve, reject) => {
    runner.once("error", reject);
    runner.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Integration tests terminated by ${signal}`));
      } else {
        process.exitCode = code ?? 1;
        resolve();
      }
    });
  });
} finally {
  database?.stop();
}
