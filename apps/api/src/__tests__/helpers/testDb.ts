import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../db/schema/index.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { ALL_USERS } from "@cs/test-fixtures";
import type { RequestIdentity } from "../../auth/plugin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://cs_user:cs_pass@localhost:5432/communication_system_test";

let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getTestDb() {
  if (!_db) throw new Error("Call setupTestDb() first");
  return _db;
}
export function getTestSql() {
  if (!_sql) throw new Error("Call setupTestDb() first");
  return _sql;
}

function findPsql(): string {
  if (process.env.PSQL_PATH && existsSync(process.env.PSQL_PATH)) {
    return process.env.PSQL_PATH;
  }
  const defaultWinPsql = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
  if (existsSync(defaultWinPsql)) {
    return defaultWinPsql;
  }
  return "psql";
}

function runPsql(file: string, dbUrl: string) {
  const psqlBin = findPsql();
  const url = new URL(dbUrl);
  execFileSync(psqlBin, ["-f", file, "-v", "ON_ERROR_STOP=1"], {
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGDATABASE: url.pathname.slice(1),
      PGUSER: url.username,
      PGPASSWORD: url.password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function setupTestDb(): Promise<void> {
  const migrationsDir = join(__dirname, "../../db/migrations");
  const dropFile = join(migrationsDir, "_drop_all.sql");
  try {
    runPsql(dropFile, TEST_DB_URL);
  } catch {
    /* ignore */
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
    .sort();

  for (const f of migrationFiles) {
    runPsql(join(migrationsDir, f), TEST_DB_URL);
  }

  _sql = postgres(TEST_DB_URL, { max: 5, idle_timeout: 5 });
  _db = drizzle(_sql, { schema });

  await _sql`GRANT USAGE ON SCHEMA public TO app_user`;
  await _sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`;
  await _sql`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_user`;
  await _sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user`;
  await _sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_user`;
}

export function getAppUserSql() {
  const url = new URL(TEST_DB_URL);
  url.username = "app_user";
  url.password = "app_pass";
  return postgres(url.toString(), { max: 1 });
}

export async function teardownTestDb(): Promise<void> {
  await _sql?.end();
  _sql = null;
  _db = null;
}

export function identityFor(tag: string): RequestIdentity {
  const user = ALL_USERS.find((u) => u.tag === tag);
  if (!user)
    throw new Error(`Unknown tag: ${tag}. Available: ${ALL_USERS.map((u) => u.tag).join(", ")}`);
  return {
    userId: user.id,
    companyId: user.company_id,
    permissions: user.permissions,
    name: user.name,
    avatarUrl: user.avatar_url,
  };
}

export async function seedUser(tag: string): Promise<void> {
  const user = ALL_USERS.find((u) => u.tag === tag);
  if (!user) throw new Error(`Unknown tag: ${tag}`);
  const db = getTestDb();
  const { sql } = await import("drizzle-orm");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.company_id', ${user.company_id}, true)`);
    await tx.execute(
      sql`INSERT INTO users(id, company_id, name, avatar_url, department_ids, project_ids)
          VALUES(${user.id}, ${user.company_id}, ${user.name}, NULL, '{}', '{}')
          ON CONFLICT(id) DO NOTHING`,
    );
  });
}
