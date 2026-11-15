import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import { rmSync } from "node:fs";
import { startTestDatabase } from "./lib/test-database.mjs";

// Never load .env or contact the application's configured database.
const name = `notebook-import-test-${randomUUID()}`;
const dir = await mkdtemp(resolve(tmpdir(), "notebook-import-"));
const script = resolve("scripts/import-notebook.mjs");
let client;
let database;
try {
  database = await startTestDatabase({
    name,
    database: "nuxt_note_import_test",
    onStop: () => rmSync(dir, { recursive: true, force: true }),
  });
  const url = database.url;
  client = new pg.Client({ connectionString: url });
  await client.connect();
  const owner = randomUUID();
  await client.query(
    'INSERT INTO "User" (id,"githubId","githubLogin",name,"updatedAt") VALUES ($1,\'fixture\',\'fixture\',\'Fixture\',now())',
    [owner],
  );
  await client.query(
    "INSERT INTO \"Note\" (id,title,markdown,\"userId\",\"updatedAt\") VALUES ('existing','Original','Preserve me',$1,now())",
    [owner],
  );
  await writeFile(resolve(dir, "tags.csv"), "id,name,user_id\n4,Work,12\n");
  const csv =
    'id,user_id,category_id,status_id,tag_id,title,content,created_at,updated_at\n1,12,1,1,4,,"First\nSecond",2026-01-01 00:30:00,2026-01-01 00:30:00\n2,12,1,1,,Plain,Body,2026-01-01 00:30:00,2026-01-01 00:30:00\n3,99,1,1,,Dummy,Ignored,2026-01-01 00:30:00,2026-01-01 00:30:00\n';
  await writeFile(resolve(dir, "notes.csv"), csv);
  const run = (apply = false, login = "fixture") =>
    spawnSync(
      process.execPath,
      [
        script,
        "--source",
        dir,
        "--source-user",
        "12",
        "--target-user",
        owner,
        "--github-login",
        login,
        "--expected-count",
        "2",
        ...(apply ? ["--apply"] : []),
      ],
      {
        cwd: dir,
        env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url },
        encoding: "utf8",
      },
    );
  const counts = async () =>
    (
      await client.query(
        'SELECT (SELECT count(*)::int FROM "Note") AS notes,(SELECT count(*)::int FROM "Category") AS categories',
      )
    ).rows[0];
  assert.equal(run().status, 0);
  assert.deepEqual(await counts(), { notes: 1, categories: 0 });
  assert.notEqual(run(true, "wrong-account").status, 0);
  // Force failure after the category and first note have been inserted.
  await client.query(
    "ALTER TABLE \"Note\" ADD CONSTRAINT fixture_failure CHECK (title <> 'Plain')",
  );
  assert.notEqual(run(true).status, 0);
  assert.deepEqual(await counts(), { notes: 1, categories: 0 });
  await client.query('ALTER TABLE "Note" DROP CONSTRAINT fixture_failure');
  const applied = run(true);
  assert.equal(applied.status, 0, applied.stderr + applied.stdout);
  assert.deepEqual(await counts(), { notes: 3, categories: 1 });
  const imported = (
    await client.query(
      'SELECT title,markdown,"categoryId",to_char("createdAt",\'YYYY-MM-DD HH24:MI:SS\') AS created FROM "Note" WHERE title = \'First\'',
    )
  ).rows[0];
  assert.equal(imported.markdown, "First\nSecond");
  assert.equal(imported.created, "2025-12-31 15:30:00");
  assert.ok(imported.categoryId);
  assert.equal(run(true).status, 0);
  assert.deepEqual(await counts(), { notes: 3, categories: 1 });
  assert.equal(
    (await client.query("SELECT markdown FROM \"Note\" WHERE id = 'existing'"))
      .rows[0].markdown,
    "Preserve me",
  );
  console.log(
    "Passed: read-only preview, owner verification, atomic rollback, import, Tokyo timestamps, repeat execution, existing-note preservation.",
  );
} finally {
  try {
    await client?.end();
  } finally {
    try {
      database?.stop();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
