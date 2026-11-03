/**
 * Universal Migration runner - executes all *.sql migrations.
 * First tries psql (with PATH and standard platform paths),
 * and automatically falls back to pg.Client driver if psql binary is not installed.
 * Works out-of-the-box on Windows, Linux, macOS, and Docker containers.
 * Run: pnpm --filter @cs/api db:migrate
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://app_user:app_pass@localhost:5432/communication_system";

const url = new URL(DATABASE_URL);
const PGHOST = url.hostname || "127.0.0.1";
const PGPORT = url.port || "5432";
const PGDATABASE = url.pathname.slice(1) || "communication_system";
const PGUSER = url.username || "app_user";
const PGPASSWORD = url.password || "app_pass";

function findPsql(): string | null {
  if (process.env.PSQL_PATH && existsSync(process.env.PSQL_PATH)) {
    return process.env.PSQL_PATH;
  }
  const candidates = [
    "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe",
    "/usr/local/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/bin/psql",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return "psql";
  } catch {
    return null;
  }
}

async function migrate() {
  const migrationsDir = join(__dirname, "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
    .sort();

  console.log(`Running ${files.length} migration(s) on ${PGDATABASE}...`);

  const psqlBin = findPsql();

  if (psqlBin) {
    console.log(`Using psql binary at: ${psqlBin}`);
    const env = {
      ...process.env,
      PGHOST,
      PGPORT,
      PGDATABASE,
      PGUSER,
      PGPASSWORD,
    };

    for (const file of files) {
      const filePath = join(migrationsDir, file);
      execFileSync(psqlBin, ["-f", filePath, "-v", "ON_ERROR_STOP=1"], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log(`  ✓ ${file}`);
    }
  } else {
    console.log("psql binary not found. Using direct pg driver fallback...");
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      for (const file of files) {
        const filePath = join(migrationsDir, file);
        const sql = await readFile(filePath, "utf-8");
        await client.query(sql);
        console.log(`  ✓ ${file} (via pg driver)`);
      }
    } finally {
      await client.end();
    }
  }

  console.log("Migrations complete.");
}

migrate().catch((err: unknown) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
