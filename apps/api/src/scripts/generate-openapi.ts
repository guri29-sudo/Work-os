import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://app_user:app_pass@localhost:5432/communication_system";
process.env.JWKS_URI = process.env.JWKS_URI ?? "http://localhost:4001/.well-known/jwks.json";
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "http://localhost:4001";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "communication-system";
process.env.WEBHOOK_SIGNING_SECRET =
  process.env.WEBHOOK_SIGNING_SECRET ?? "default_webhook_secret_for_openapi_32chars";
process.env.NODE_ENV = "test";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { buildApp } = await import("../server.js");
  const app = await buildApp({ testing: true });
  await app.ready();
  const swagger = app.swagger();
  const outPath = resolve(__dirname, "../../../../docs/openapi.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(swagger, null, 2) + "\n", "utf-8");
  console.log(
    `Generated openapi.json at ${outPath} with ${Object.keys(swagger.paths ?? {}).length} paths`,
  );
  await app.close();
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
