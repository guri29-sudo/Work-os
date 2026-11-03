/**
 * Mock IdP configuration – loaded from env with safe local defaults.
 * This module ONLY runs in the development mock IdP process.
 */
import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z
    .string()
    .optional()
    .default("4001")
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),
  MOCK_IDP_ISSUER: z
    .string()
    .url()
    .optional()
    .default("http://localhost:4001"),
  JWT_AUDIENCE: z.string().optional().default("communication-system"),
  TOKEN_TTL_SECONDS: z
    .string()
    .optional()
    .default("900")
    .transform(Number)
    .pipe(z.number().int().min(60).max(900)),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[mock-idp] Invalid configuration:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
