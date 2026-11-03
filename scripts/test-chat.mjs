import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { createServer as httpServer } from "node:http";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { seal } from "../node_modules/nuxt/dist/server/iron.js";

// Build first. This harness never loads .env and never contacts Supabase/OpenAI.
const root = new URL("../", import.meta.url);
const name = `nuxt-note-chat-test-${process.pid}`;
const owner = "11111111-1111-4111-8111-111111111111";
const secret = randomBytes(32).toString("hex");
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 120_000 });
const freePort = await new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const port = s.address().port;
    s.close(() => resolve(port));
  });
});
let app;
let logs = "";
let started = false;
try {
  docker(
    "run",
    "--rm",
    "--detach",
    "--name",
    name,
    "--publish",
    "127.0.0.1::5432",
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "--env",
    "POSTGRES_DB=nuxt_note_chat_test",
    "postgres:17-alpine",
  );
  started = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      docker("exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres");
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  assert(ready, "PostgreSQL did not become ready");
  const dbPort = docker("port", name, "5432/tcp").trim().split(":").at(-1);
  const sql =
    readFileSync(
      new URL("prisma/migrations/20261103000000_init/migration.sql", root),
      "utf8",
    ) +
    `\nINSERT INTO "User" (id, "githubId", "githubLogin", name, "updatedAt") VALUES ('${owner}', 'test', 'test', 'Test', now());`;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "nuxt_note_chat_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: sql, encoding: "utf8" },
  );
  app = spawn(
    process.execPath,
    [
      "--import",
      new URL("tests/helpers/openai-stream.mjs", root).pathname,
      new URL(".output/server/index.mjs", root).pathname,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(freePort),
        DATABASE_URL: `postgresql://postgres@127.0.0.1:${dbPort}/nuxt_note_chat_test`,
        NUXT_APP_SECRET: secret,
        NUXT_OPENAI_API_KEY: "test-only",
        NUXT_OPENAI_MODEL: "test-model",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  app.stdout.on("data", (data) => {
    logs = (logs + data).slice(-6000);
  });
  app.stderr.on("data", (data) => {
    logs = (logs + data).slice(-6000);
  });
  const base = `http://127.0.0.1:${freePort}`;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {
      /* startup */
    }
    await delay(100);
  }
  const password = Buffer.from(
    hkdfSync("sha256", secret, "nuxt", "nuxt-session:nuxt-auth-session", 32),
  ).toString("hex");
  const cookieFor = async (id) =>
    `nuxt-auth-session=${await seal({ nuxt: 1, id: randomUUID(), data: { user: { id, name: "Test", githubLogin: "test" } } }, password)}`;
  const cookie = await cookieFor(owner);
  const api = (path, body, options = {}) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...options,
    });
  assert.equal((await fetch(base + "/api/chats")).status, 401);
  const chatId = randomUUID();
  const messageId = randomUUID();
  const first = { chatId, messageId, content: "SLOW", categoryId: null };
  assert.equal((await api("/api/chats", first)).status, 201);
  assert.equal((await api("/api/chats", first)).status, 200);
  const path = `/api/chats/${chatId}`;
  const attemptId = randomUUID();
  const abort = new AbortController();
  const response = await api(
    path + "/generate",
    { messageId, attemptId },
    { signal: abort.signal },
  );
  assert.equal(response.status, 200);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let events = "";
  while (!events.includes('"type":"text"')) {
    const next = await reader.read();
    assert(!next.done);
    events += next.value;
  }
  assert.equal(
    (await api(path + "/generate", { messageId, attemptId: randomUUID() }))
      .status,
    409,
  );
  assert.equal((await api(path + "/stop", { attemptId })).status, 204);
  abort.abort();
  let saved = await (await api(path)).json();
  assert.equal(saved.generationId, null);
  assert.equal(saved.messages.at(-1).status, "stopped");
  assert.equal(saved.messages.at(-1).content, "Partial");
  const replyId = saved.messages.at(-1).id;
  const retry = await api(path + "/generate", {
    messageId,
    attemptId: randomUUID(),
  });
  assert.match(await retry.text(), /"status":"completed"/);
  saved = await (await api(path)).json();
  assert.equal(saved.messages.length, 2);
  assert.equal(saved.messages.at(-1).id, replyId);
  assert.equal(saved.messages.at(-1).content, "Partial answer");
  const nextId = randomUUID();
  assert.equal(
    (await api(path + "/messages", { messageId: nextId, content: "FAIL" }))
      .status,
    200,
  );
  assert.equal(
    (await api(path + "/messages", { messageId: nextId, content: "FAIL" }))
      .status,
    200,
  );
  const failed = await api(path + "/generate", {
    messageId: nextId,
    attemptId: randomUUID(),
  });
  assert.match(await failed.text(), /"status":"failed"/);
  const again = await api(path + "/generate", {
    messageId: nextId,
    attemptId: randomUUID(),
  });
  assert.match(await again.text(), /"status":"completed"/);
  saved = await (await api(path)).json();
  assert.equal(saved.messages.length, 4);
  assert.equal(saved.generationId, null);
  const disconnectId = randomUUID();
  await api(path + "/messages", {
    messageId: disconnectId,
    content: "SLOW disconnect",
  });
  const disconnected = new AbortController();
  const interrupted = await api(
    path + "/generate",
    { messageId: disconnectId, attemptId: randomUUID() },
    { signal: disconnected.signal },
  );
  const interruptedReader = interrupted.body
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let partial = "";
  while (!partial.includes('"type":"text"')) {
    const next = await interruptedReader.read();
    assert(!next.done);
    partial += next.value;
  }
  disconnected.abort();
  for (let i = 0; i < 40; i++) {
    saved = await (await api(path)).json();
    if (!saved.generationId) break;
    await delay(50);
  }
  assert.equal(saved.generationId, null);
  assert.equal(saved.messages.at(-1).status, "stopped");
  assert.equal(saved.messages.at(-1).content, "Partial");
  const foreign = await cookieFor("22222222-2222-4222-8222-222222222222");
  assert.equal(
    (await api(path, undefined, { headers: { Cookie: foreign } })).status,
    404,
  );
  assert.equal(
    (
      await api(
        path + "/generate",
        { messageId: nextId, attemptId: randomUUID() },
        { headers: { Cookie: foreign, "Content-Type": "application/json" } },
      )
    ).status,
    404,
  );
  // Notes share this isolated app, session and database; never touch live data.
  const noteBody = { title: "Original", markdown: "# Hello", categoryId: null };
  const newNote = await (await api("/api/notes", noteBody)).json();
  const notePath = `/api/notes/${newNote.id}`;
  assert.equal(
    (
      await fetch(base + notePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteBody),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api(notePath, noteBody, {
        method: "PATCH",
        headers: { Cookie: foreign, "Content-Type": "application/json" },
      })
    ).status,
    404,
  );
  const category = await (
    await api("/api/categories", { name: "Notes fixture" })
  ).json();
  const changed = {
    title: "  ",
    markdown: "## Updated\n\n| A | B |\n| - | - |\n| 1 | 2 |",
    categoryId: category.id,
  };
  assert.equal((await api(notePath, changed, { method: "PATCH" })).status, 200);
  const updatedNote = await (await api(notePath)).json();
  assert.equal(updatedNote.title, "Untitled note");
  assert.equal(updatedNote.markdown, changed.markdown);
  assert.equal(updatedNote.categoryId, category.id);
  assert(
    Date.parse(updatedNote.updatedAt) >= Date.parse(updatedNote.createdAt),
  );
  assert.equal(
    (
      await api(notePath, undefined, {
        method: "DELETE",
        headers: { Cookie: foreign },
      })
    ).status,
    404,
  );
  assert.equal(
    (await api(notePath, undefined, { method: "DELETE" })).status,
    204,
  );
  assert.equal((await api(notePath)).status, 404);
  assert.equal((await api(notePath, changed, { method: "PATCH" })).status, 404);
  console.log(
    "Notes HTTP smoke passed: create/update/category/default title/delete, auth and owner isolation.",
  );
  console.log(
    "Chat HTTP smoke passed: auth, create/send idempotency, streaming, concurrency, stop/partial save, retry, disconnect, provider failure, owner isolation.",
  );
  if (process.argv.includes("--preview")) {
    const preview = httpServer(async (request, response) => {
      try {
        const upstream = await fetch(base + request.url, {
          method: request.method,
          headers: { ...request.headers, host: new URL(base).host, cookie },
          ...(request.method !== "GET" && request.method !== "HEAD"
            ? { body: Readable.toWeb(request), duplex: "half" }
            : {}),
          redirect: "manual",
        });
        response.writeHead(
          upstream.status,
          Object.fromEntries(
            [...upstream.headers].filter(
              ([key]) => !["content-encoding", "content-length"].includes(key),
            ),
          ),
        );
        if (upstream.body) Readable.fromWeb(upstream.body).pipe(response);
        else response.end();
      } catch {
        response.writeHead(502);
        response.end("Preview unavailable");
      }
    });
    await new Promise((resolve) => preview.listen(3012, "127.0.0.1", resolve));
    console.log(
      "Fixture preview: http://127.0.0.1:3012/chats/new (mock AI; temporary database)",
    );
    await new Promise((resolve) => {
      process.once("SIGTERM", resolve);
      process.once("SIGINT", resolve);
    });
    preview.closeAllConnections();
    preview.close();
  }
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  app?.kill("SIGTERM");
  if (started) docker("stop", name);
}
