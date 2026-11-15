import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { inspect } from "node:util";

const root = new URL("../../", import.meta.url);
const docker = (args, options = {}) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });

export function readTestMigrations(
  directory = new URL("prisma/migrations/", root),
) {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (!names.length) throw new Error("No test database migrations found");
  return names
    .map((name) =>
      readFileSync(new URL(`${name}/migration.sql`, directory), "utf8"),
    )
    .join("\n");
}

// These databases are always disposable. Never load application credentials.
export async function startTestDatabase({
  name,
  database,
  publish = true,
  onStop = () => {},
}) {
  let attempted = false;
  let started = false;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    const errors = [];
    try {
      onStop();
    } catch (error) {
      errors.push(error);
    }
    if (attempted) {
      try {
        docker(["rm", "--force", "--volumes", name], {
          stdio: ["ignore", "ignore", "pipe"],
        });
      } catch (error) {
        // A failed docker run may not have created a container at all.
        if (started) errors.push(error);
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, "Test resource cleanup failed");
    }
  };
  const exit = (code) => {
    try {
      stop();
    } catch (error) {
      // Flush diagnostics before process.exit, including when stderr is piped.
      writeSync(
        process.stderr.fd,
        `Failed to clean up test database container "${name}": ${inspect(error)}\n`,
      );
    } finally {
      process.exit(code);
    }
  };
  const interrupt = () => exit(130);
  const terminate = () => exit(143);
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);

  const executeSql = (input) =>
    docker(
      [
        "exec",
        "--interactive",
        name,
        "psql",
        "-h",
        "127.0.0.1",
        "-X",
        "-U",
        "postgres",
        "-d",
        database,
        "--set",
        "ON_ERROR_STOP=1",
        "--quiet",
      ],
      { input },
    );

  try {
    try {
      docker(["info"], { stdio: "ignore" });
    } catch {
      throw new Error("Database tests require Docker. Start its daemon first.");
    }
    attempted = true;
    docker([
      "run",
      "--detach",
      "--name",
      name,
      ...(publish ? ["--publish", "127.0.0.1::5432"] : ["--network", "none"]),
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--env",
      `POSTGRES_DB=${database}`,
      "postgres:17-alpine",
    ]);
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        docker(
          ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
          { stdio: "ignore" },
        );
        ready = true;
        break;
      } catch {
        await delay(250);
      }
    }
    if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
    executeSql(readTestMigrations());
    const port = publish
      ? docker(["port", name, "5432/tcp"]).trim().split(":").at(-1)
      : undefined;
    return {
      url: publish
        ? `postgresql://postgres@127.0.0.1:${port}/${database}`
        : undefined,
      executeSql,
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}
