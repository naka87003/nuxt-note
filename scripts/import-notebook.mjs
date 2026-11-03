import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { parseCsv, prepareNotes, stableId } from "./lib/notebook-import.mjs";

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    "source-user": { type: "string" },
    "target-user": { type: "string" },
    "github-login": { type: "string" },
    "expected-count": { type: "string" },
    apply: { type: "boolean", default: false },
  },
});
for (const key of [
  "source",
  "source-user",
  "target-user",
  "github-login",
  "expected-count",
]) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}
const load = async (name) =>
  parseCsv(await readFile(resolve(values.source, `${name}.csv`), "utf8"));
const prepared = prepareNotes(
  await load("notes"),
  await load("tags"),
  values["source-user"],
  values["target-user"],
);
if (!prepared.length || prepared.length !== Number(values["expected-count"]))
  throw new Error("Unexpected source count");
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL)
  throw new Error("Database is not configured");
let inTransaction = false;
try {
  await client.connect();
  await client.query(
    values.apply
      ? "BEGIN ISOLATION LEVEL REPEATABLE READ"
      : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  inTransaction = true;
  if (values.apply)
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `notebook-import:${values["target-user"]}`,
    ]);
  const { rows: users } = await client.query(
    'SELECT id, "githubLogin" FROM "User" WHERE id = $1',
    [values["target-user"]],
  );
  if (users.length !== 1 || users[0].githubLogin !== values["github-login"])
    throw new Error("Target identity mismatch");
  const { rows: categories } = await client.query(
    'SELECT * FROM "Category" WHERE "userId" = $1',
    [values["target-user"]],
  );
  const { rows: existing } = await client.query(
    'SELECT * FROM "Note" WHERE "userId" = $1',
    [values["target-user"]],
  );
  const categoryIds = new Map(categories.map((c) => [c.nameKey, c.id]));
  const existingIds = new Set(existing.map((n) => n.id));
  const pending = prepared.filter((n) => !existingIds.has(n.id));
  const newCategories = new Map();
  for (const note of pending) {
    if (note.categoryKey && !categoryIds.has(note.categoryKey)) {
      const id = stableId(values["target-user"], "category", note.categoryKey);
      categoryIds.set(note.categoryKey, id);
      newCategories.set(id, note);
    }
  }
  const summary = {
    mode: values.apply ? "apply" : "dry-run",
    githubLogin: users[0].githubLogin,
    sourceTimezone: "Asia/Tokyo",
    sourceNotes: prepared.length,
    existingNotes: existing.length,
    insertNotes: pending.length,
    skipPreviouslyImported: prepared.length - pending.length,
    insertCategories: newCategories.size,
    uncategorized: prepared.filter((n) => !n.categoryKey).length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (values.apply) {
    const output = resolve(".data/notebook-import");
    await mkdir(output, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    // Keep the pre-import state and exact planned IDs outside version control.
    await writeFile(
      resolve(output, `${stamp}-backup.json`),
      JSON.stringify(
        { targetUser: users[0], categories, notes: existing },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    const manifest = {
      ...summary,
      targetUserId: values["target-user"],
      insertedNoteIds: pending.map((n) => n.id),
      insertedCategoryIds: [...newCategories.keys()],
      sourceMapping: prepared.map((n) => ({
        sourceId: n.sourceId,
        targetId: n.id,
      })),
    };
    const manifestPath = resolve(output, `${stamp}-manifest.json`);
    await writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, status: "pending" }, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    for (const [id, note] of newCategories) {
      await client.query(
        'INSERT INTO "Category" (id, name, "nameKey", "userId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [id, note.categoryName, note.categoryKey, values["target-user"]],
      );
    }
    for (const note of pending) {
      await client.query(
        'INSERT INTO "Note" (id, title, markdown, "userId", "categoryId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7::timestamp)',
        [
          note.id,
          note.title,
          note.markdown,
          values["target-user"],
          note.categoryKey ? categoryIds.get(note.categoryKey) : null,
          note.createdAt,
          note.updatedAt,
        ],
      );
    }
    const { rows: verified } = await client.query(
      'SELECT id, title, markdown, "categoryId", to_char("createdAt", \'YYYY-MM-DD HH24:MI:SS.MS\') AS "createdAt", to_char("updatedAt", \'YYYY-MM-DD HH24:MI:SS.MS\') AS "updatedAt" FROM "Note" WHERE "userId" = $1 AND id = ANY($2::text[])',
      [values["target-user"], pending.map((n) => n.id)],
    );
    const byId = new Map(verified.map((n) => [n.id, n]));
    for (const note of pending) {
      const saved = byId.get(note.id);
      if (
        !saved ||
        saved.title !== note.title ||
        saved.markdown !== note.markdown ||
        saved.categoryId !== (categoryIds.get(note.categoryKey) ?? null) ||
        saved.createdAt !== note.createdAt ||
        saved.updatedAt !== note.updatedAt
      )
        throw new Error("Imported content verification failed");
    }
    await client.query("COMMIT");
    inTransaction = false;
    await writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, status: "committed" }, null, 2),
      { mode: 0o600 },
    );
    console.log("Import committed and content/timestamps verified.");
  } else {
    await client.query("ROLLBACK");
    inTransaction = false;
    console.log("Dry run complete. No database changes.");
  }
} catch (error) {
  if (inTransaction) await client.query("ROLLBACK");
  console.error(
    `Import failed (${error.code || error.message}). No existing notes are overwritten.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
