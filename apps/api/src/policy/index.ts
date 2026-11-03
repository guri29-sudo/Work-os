/**
 * Authorization policy module.
 * NEVER perform ad-hoc permission checks — always use this module.
 * All checks run server-side against token claims (never DB lookups for basic authz).
 */
import type { RequestIdentity } from "../auth/plugin.js";

export class AuthorizationError extends Error {
  public readonly statusCode = 403;
  public readonly code = "FORBIDDEN";
  constructor(
    public readonly required: string,
    public readonly userId: string,
  ) {
    super(`User ${userId} lacks permission: ${required}`);
    this.name = "AuthorizationError";
  }
}

export const policy = {
  /**
   * Throws a 403 if the identity does not hold the required permission.
   * Call at the very start of every route handler.
   */
  require(identity: RequestIdentity, permission: string): void {
    if (!identity.permissions.includes(permission)) {
      throw new AuthorizationError(permission, identity.userId);
    }
  },

  /** Returns true/false without throwing */
  can(identity: RequestIdentity, permission: string): boolean {
    return identity.permissions.includes(permission);
  },

  /** Requires that the identity's company matches the resource's company */
  requireSameCompany(identity: RequestIdentity, resourceCompanyId: string): void {
    if (identity.companyId !== resourceCompanyId) {
      throw new AuthorizationError("same-company", identity.userId);
    }
  },
};
