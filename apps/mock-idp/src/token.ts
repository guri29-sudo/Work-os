/**
 * Token issuer for the mock IdP.
 * Signs RS256 JWTs with jose v6.
 * Dev only – never use in production.
 */
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { keyStore } from "./keypair.js";
import type { SyntheticUser } from "@cs/test-fixtures";

export interface IssuedToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  expires_at: string;
  claims: {
    sub: string;
    company_id: string;
    permissions: string[];
    name: string;
    avatar_url: string;
    department_ids: string[];
    project_ids: string[];
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    jti: string;
  };
}

export async function issueToken(user: SyntheticUser): Promise<IssuedToken> {
  const key = keyStore.getCurrentKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + config.TOKEN_TTL_SECONDS;
  const jti = randomUUID();

  const claims = {
    sub: user.id,
    company_id: user.company_id,
    permissions: user.permissions as string[],
    name: user.name,
    avatar_url: user.avatar_url,
    department_ids: user.department_ids,
    project_ids: user.project_ids,
    iss: config.MOCK_IDP_ISSUER,
    aud: config.JWT_AUDIENCE,
    iat: now,
    exp,
    jti,
  };

  // jose v6 – cast private key to the expected type
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: key.kid, typ: "JWT" })
    .sign(key.privateKey as Parameters<typeof SignJWT.prototype.sign>[0]);

  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: config.TOKEN_TTL_SECONDS,
    expires_at: new Date(exp * 1000).toISOString(),
    claims,
  };
}
