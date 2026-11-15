import { readFileSync } from "node:fs";
import { startTestDatabase } from "./lib/test-database.mjs";

const root = new URL("../", import.meta.url);
let database;

try {
  database = await startTestDatabase({
    name: `nuxt-note-foundation-test-${process.pid}-${Date.now()}`,
    database: "nuxt_note_foundation_test",
    publish: false,
  });

  const sql = [
    "tests/database/chat-foundation.sql",
    "tests/database/chat-foundation-assertions.sql",
  ]
    .map((path) => readFileSync(new URL(path, root), "utf8"))
    .join("\n");

  console.log(database.executeSql(sql).trim());
} finally {
  database?.stop();
}
