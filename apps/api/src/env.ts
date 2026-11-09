import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development","production","test"]).default("development"),
  API_PORT: z.preprocess(
    (val) => val ?? process.env.PORT,
    z.coerce.number().int().min(1).max(65535).default(3001),
  ),
  API_HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url().default("postgresql://app_user:app_pass@localhost:5432/communication_system"),
  JWKS_URI: z.preprocess(
    (val) => val ?? process.env.JWKS_URL,
    z.string().url().default("http://localhost:4001/.well-known/jwks.json"),
  ),
  JWT_ISSUER: z.string().min(1).default("http://localhost:4001"),
  JWT_AUDIENCE: z.string().min(1).default("communication-system"),
  CORS_ORIGINS: z.preprocess(
    (val) => val ?? process.env.CORS_ORIGIN,
    z.string().default("http://localhost:5173"),
  ),
  WEBHOOK_SIGNING_SECRET: z.string().min(16).default("dev_webhook_signing_secret_change_in_production"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOG_LEVEL: z.enum(["trace","debug","info","warn","error","fatal","silent"]).default("info"),
  STORAGE_ENDPOINT: z.string().default("http://localhost:9000"),
  STORAGE_ACCESS_KEY: z.string().default("minio_access"),
  STORAGE_SECRET_KEY: z.string().default("minio_secret"),
  STORAGE_BUCKET: z.string().default("cs-attachments"),
  STORAGE_REGION: z.string().default("us-east-1"),
  AI_API_KEY: z.string().optional(),
  AI_SUMMARY_MODEL: z.string().default("gemini-1.5-flash"),
  AI_BASE_URL: z.string().optional(),
  AI_PROVIDER: z.enum(["google", "openai", "auto", "mock"]).default("auto"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("? Invalid environment variables:");
  for (const [field, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${issues?.join(", ") ?? "unknown"}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof parsed.data;
