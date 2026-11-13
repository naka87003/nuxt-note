import assert from "node:assert/strict";
import { randomBytes, randomUUID, hkdfSync, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "dotenv";
import pg from "pg";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { seal } from "../node_modules/nuxt/dist/server/iron.js";

// This is intentionally opt-in: it adds and removes identified verification data.
if (!process.argv.includes("--live")) {
  console.error(
    "Build first, then pass --live to verify the configured database. See docs/mcp-notes.md.",
  );
  process.exit(1);
}
config({ quiet: true });
const db = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
});
const marker = `MCP ${randomUUID()}`;
const other = randomUUID();
const ownNote = randomUUID();
const secondNote = randomUUID();
const foreignNote = randomUUID();
const secret = randomBytes(32).toString("hex");
const root = new URL("../", import.meta.url);
let app;
let owner;
let remote;
let remoteOther;
let failed = false;
try {
  await db.connect();
  const users = await db.query(
    'SELECT u.id FROM "User" u LEFT JOIN "Note" n ON n."userId"=u.id GROUP BY u.id ORDER BY count(n.id) DESC, u.id LIMIT 1',
  );
  assert(users.rowCount, "Sign in to the app once before live verification.");
  owner = users.rows[0].id;
  await db.query(
    'INSERT INTO "User" (id,"githubId","githubLogin",name,"updatedAt") VALUES ($1,$2,$2,$2,now())',
    [other, marker],
  );
  for (const [id, userId] of [
    [ownNote, owner],
    [secondNote, owner],
    [foreignNote, other],
  ]) {
    await db.query(
      'INSERT INTO "Note" (id,title,markdown,"userId","updatedAt") VALUES ($1,$2,$3,$4,now())',
      [id, marker, "# MCP verification\n\nLiteral 50%_ search.", userId],
    );
  }
  const port = await new Promise((resolve) => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  app = spawn(
    process.execPath,
    [new URL(".output/server/index.mjs", root).pathname],
    {
      cwd: root,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        NUXT_APP_SECRET: secret,
      },
      stdio: "ignore",
    },
  );
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Waiting for the isolated local app. */
    }
    await delay(100);
  }
  assert(ready, "Built app did not start.");
  // A test-only session secret is used by this isolated process, not the running app.
  const password = Buffer.from(
    hkdfSync("sha256", secret, "nuxt", "nuxt-session:nuxt-auth-session", 32),
  ).toString("hex");
  const cookieFor = async (id) =>
    `nuxt-auth-session=${await seal({ nuxt: 1, id: randomUUID(), data: { user: { id, name: "MCP verification", githubLogin: "verification" } } }, password)}`;
  const cookie = await cookieFor(owner);
  const api = (path, options = {}) => fetch(base + path, options);
  const issue = await api("/api/agent-tokens", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: marker, userId: other }),
  });
  assert.equal(issue.status, 201);
  assert.match(issue.headers.get("cache-control"), /no-store/);
  const issued = await issue.json();
  assert(!("tokenHash" in issued));
  const stored = await db.query(
    'SELECT "tokenHash","userId" FROM "AgentToken" WHERE id=$1',
    [issued.id],
  );
  assert.equal(stored.rows[0].userId, owner);
  assert.equal(
    stored.rows[0].tokenHash,
    createHash("sha256").update(issued.token).digest("hex"),
  );
  const headers = { Authorization: `Bearer ${issued.token}` };
  assert.equal((await api("/api/agent-tokens", { headers })).status, 401);
  assert.equal(
    (
      await api("/api/notes", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ title: marker, markdown: "must not save" }),
      })
    ).status,
    401,
  );
  const metadata = await (
    await api("/api/agent-tokens", { headers: { Cookie: cookie } })
  ).json();
  assert(metadata.some((t) => t.id === issued.id));
  assert(metadata.every((t) => !("token" in t) && !("tokenHash" in t)));
  assert.equal(
    (
      await api(`/api/agent-tokens/${issued.id}`, {
        method: "DELETE",
        headers: { Cookie: await cookieFor(other) },
      })
    ).status,
    404,
  );

  const rpcHeaders = {
    ...headers,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  assert.equal(
    (
      await api("/mcp", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api("/mcp", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json", Cookie: cookie },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api("/mcp", {
        method: "POST",
        body: "{}",
        headers: { ...rpcHeaders, Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal((await api("/mcp", { headers })).status, 405);
  assert.equal(
    (await api("/mcp", { method: "OPTIONS", headers: { Origin: base } }))
      .status,
    204,
  );
  assert.equal(
    (
      await api("/mcp", {
        method: "POST",
        headers: { ...rpcHeaders, "Content-Type": "text/plain" },
        body: "{}",
      })
    ).status,
    415,
  );
  assert.equal(
    (await api("/mcp", { method: "POST", headers: rpcHeaders, body: "{" }))
      .status,
    400,
  );
  assert.equal(
    (
      await api("/mcp", {
        method: "POST",
        headers: rpcHeaders,
        body: "x".repeat(65_537),
      })
    ).status,
    413,
  );
  const legacy = await api("/mcp", {
    method: "POST",
    headers: rpcHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "legacy-check", version: "0.1.0" },
      },
    }),
  });
  assert.equal(legacy.status, 200);
  assert.match(legacy.headers.get("cache-control"), /no-store/);
  assert.equal(legacy.headers.get("mcp-session-id"), null);
  assert.match(await legacy.text(), /nuxt-note/);
  remote = new Client({ name: "remote-verification", version: "0.1.0" });
  await remote.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", base), {
      requestInit: { headers },
    }),
  );
  assert.deepEqual((await remote.listTools()).tools.map((t) => t.name).sort(), [
    "get_note",
    "list_notes",
  ]);
  const remoteSearch = await remote.callTool({
    name: "list_notes",
    arguments: { q: marker, limit: 1 },
  });
  assert(!remoteSearch.isError);
  assert.equal(remoteSearch.structuredContent.notes.length, 1);
  assert.equal(remoteSearch.structuredContent.nextOffset, 1);
  const remoteNote = await remote.callTool({
    name: "get_note",
    arguments: { id: ownNote },
  });
  assert(!remoteNote.isError);
  assert.equal(
    remoteNote.structuredContent.markdown,
    "# MCP verification\n\nLiteral 50%_ search.",
  );
  assert(!("userId" in remoteNote.structuredContent));
  assert(!("markdown" in remoteSearch.structuredContent.notes[0]));
  const lastPage = await remote.callTool({
    name: "list_notes",
    arguments: {
      q: marker,
      limit: 1,
      offset: remoteSearch.structuredContent.nextOffset,
    },
  });
  assert(!lastPage.isError);
  assert.equal(lastPage.structuredContent.nextOffset, null);
  assert.equal(lastPage.structuredContent.notes.length, 1);
  assert.notEqual(
    lastPage.structuredContent.notes[0].id,
    remoteSearch.structuredContent.notes[0].id,
  );
  const wildcard = await remote.callTool({
    name: "list_notes",
    arguments: { q: "50%_" },
  });
  assert(!wildcard.isError);
  assert(wildcard.structuredContent.notes.some((n) => n.id === ownNote));
  assert.equal(
    (
      await remote.callTool({
        name: "get_note",
        arguments: { id: randomUUID() },
      })
    ).isError,
    true,
  );
  assert.equal(
    (
      await remote.callTool({
        name: "get_note",
        arguments: { id: foreignNote },
      })
    ).isError,
    true,
  );
  assert.equal(
    (await remote.callTool({ name: "list_notes", arguments: { limit: 51 } }))
      .isError,
    true,
  );
  const otherIssue = await api("/api/agent-tokens", {
    method: "POST",
    headers: {
      Cookie: await cookieFor(other),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: marker }),
  });
  assert.equal(otherIssue.status, 201);
  const otherToken = (await otherIssue.json()).token;
  remoteOther = new Client({
    name: "remote-other-verification",
    version: "0.1.0",
  });
  await remoteOther.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", base), {
      requestInit: { headers: { Authorization: `Bearer ${otherToken}` } },
    }),
  );
  const [owned, foreign] = await Promise.all([
    remote.callTool({ name: "get_note", arguments: { id: ownNote } }),
    remoteOther.callTool({ name: "get_note", arguments: { id: ownNote } }),
  ]);
  assert(!owned.isError);
  assert.equal(foreign.isError, true);
  assert(
    !(
      await remoteOther.callTool({
        name: "get_note",
        arguments: { id: foreignNote },
      })
    ).isError,
  );

  await db.query(
    'UPDATE "AgentToken" SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',
    [issued.id],
  );
  assert.equal(
    (
      await api("/mcp", {
        method: "POST",
        headers: rpcHeaders,
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      })
    ).status,
    401,
  );
  await db.query(
    'UPDATE "AgentToken" SET "expiresAt"=now()+interval \'1 day\' WHERE id=$1',
    [issued.id],
  );
  assert.equal(
    (
      await api(`/api/agent-tokens/${issued.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    ).status,
    204,
  );
  await assert.rejects(remote.callTool({ name: "list_notes", arguments: {} }));
  console.log(
    "Passed: session-only issuance, hash storage, pagination/search, owner isolation, expiry, revocation, and real MCP reads. No existing Note content was printed or edited.",
  );
} catch (error) {
  failed = true;
  // Avoid dumping HTTP request headers or database connection information.
  console.error(
    "Agent verification failed:",
    error instanceof assert.AssertionError
      ? error.message
      : (error.code ?? error.name),
  );
} finally {
  await remoteOther?.close();
  await remote?.close();
  app?.kill("SIGTERM");
  try {
    if (owner) {
      await db.query('DELETE FROM "AgentToken" WHERE "userId"=$1 AND name=$2', [
        owner,
        marker,
      ]);
      await db.query(
        'DELETE FROM "Note" WHERE "userId"=$1 AND id=ANY($2::text[])',
        [owner, [ownNote, secondNote]],
      );
    }
    await db.query('DELETE FROM "User" WHERE id=$1 AND "githubId"=$2', [
      other,
      marker,
    ]);
    console.log("Removed only this run's verification records.");
  } catch {
    console.error(
      "Verification cleanup failed. Inspect records named:",
      marker,
    );
    failed = true;
  }
  await db.end();
}
if (failed) process.exitCode = 1;
