import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  readTestMigrations,
  startTestDatabase,
} from "~~/scripts/lib/test-database.mjs";

const { docker, writeError } = vi.hoisted(() => ({
  docker: vi.fn(),
  writeError: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFileSync: docker }));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  writeSync: writeError,
}));

beforeEach(() => {
  writeError.mockReset();
  docker
    .mockReset()
    .mockImplementation((_command, args) =>
      args[0] === "port" ? "127.0.0.1:54321\n" : "",
    );
});
afterEach(() => vi.restoreAllMocks());

it("applies every migration in directory order and ignores metadata files", () => {
  const directory = mkdtempSync(join(tmpdir(), "nuxt-note-migrations-"));

  try {
    for (const name of ["20260202_second", "20260101_first"]) {
      mkdirSync(join(directory, name));
      writeFileSync(join(directory, name, "migration.sql"), name);
    }

    writeFileSync(join(directory, "migration_lock.toml"), "metadata");
    expect(readTestMigrations(pathToFileURL(`${directory}/`))).toBe(
      "20260101_first\n20260202_second",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("removes its container and signal handlers exactly once", async () => {
  const before = process.listenerCount("SIGINT");
  const onStop = vi.fn();

  const database = await startTestDatabase({
    name: "fixture",
    database: "fixture_db",
    onStop,
  });

  expect(database.url).toBe("postgresql://postgres@127.0.0.1:54321/fixture_db");
  expect(process.listenerCount("SIGINT")).toBe(before + 1);
  database.stop();
  database.stop();
  expect(onStop).toHaveBeenCalledOnce();
  expect(process.listenerCount("SIGINT")).toBe(before);
  expect(docker.mock.calls.filter(([, args]) => args[0] === "rm")).toHaveLength(
    1,
  );
});

it("cleans up a partially created container if startup fails", async () => {
  const before = process.listenerCount("SIGTERM");
  docker.mockImplementation((_command, args) => {
    if (args[0] === "run") throw new Error("Startup failed");

    return "";
  });
  await expect(
    startTestDatabase({ name: "fixture", database: "fixture_db" }),
  ).rejects.toThrow("Startup failed");
  expect(docker).toHaveBeenCalledWith(
    "docker",
    ["rm", "--force", "--volumes", "fixture"],
    expect.anything(),
  );
  expect(process.listenerCount("SIGTERM")).toBe(before);
});

it("removes its container when applying migrations fails", async () => {
  docker.mockImplementation((_command, args) => {
    if (args.includes("psql")) throw new Error("Migration failed");

    return "";
  });
  await expect(
    startTestDatabase({ name: "fixture", database: "fixture_db" }),
  ).rejects.toThrow("Migration failed");
  expect(docker).toHaveBeenCalledWith(
    "docker",
    ["rm", "--force", "--volumes", "fixture"],
    expect.anything(),
  );
});

it.each([
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const)(
  "stops child resources and removes the database before exiting on %s",
  async (signal, exitCode) => {
    const existing = process.listeners(signal);
    const onStop = vi.fn();

    const database = await startTestDatabase({
      name: "fixture",
      database: "fixture_db",
      onStop,
    });

    const handler = process
      .listeners(signal)
      .find((item) => !existing.includes(item));

    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("Process exit");
    });

    try {
      expect(handler).toBeDefined();
      expect(() => handler?.(signal)).toThrow("Process exit");
      expect(onStop).toHaveBeenCalledOnce();
      expect(docker).toHaveBeenLastCalledWith(
        "docker",
        ["rm", "--force", "--volumes", "fixture"],
        expect.anything(),
      );
      expect(exit).toHaveBeenCalledWith(exitCode);
      expect(writeError).not.toHaveBeenCalled();
    } finally {
      database.stop();
    }
  },
);

it.each([
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const)(
  "reports cleanup failures before exiting on %s",
  async (signal, exitCode) => {
    const existing = process.listeners(signal);

    const database = await startTestDatabase({
      name: "fixture",
      database: "fixture_db",
      onStop: () => {
        throw new Error("Child cleanup failed");
      },
    });

    docker.mockImplementation((_command, args) => {
      if (args[0] === "rm") {
        throw Object.assign(new Error("Docker deletion failed"), {
          stderr: "Cannot connect to the Docker daemon",
        });
      }

      return "";
    });

    const handler = process
      .listeners(signal)
      .find((item) => !existing.includes(item));

    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      expect(writeError).toHaveBeenCalledOnce();
      throw new Error("Process exit");
    });

    try {
      expect(handler).toBeDefined();
      expect(() => handler?.(signal)).toThrow("Process exit");
      expect(writeError).toHaveBeenCalledWith(
        process.stderr.fd,
        expect.stringContaining('container "fixture"'),
      );
      const message = writeError.mock.calls[0]![1];
      expect(message).toContain("Child cleanup failed");
      expect(message).toContain("Docker deletion failed");
      expect(message).toContain("Cannot connect to the Docker daemon");
      expect(exit).toHaveBeenCalledWith(exitCode);
    } finally {
      database.stop();
    }
  },
);
