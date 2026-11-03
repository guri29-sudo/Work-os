/**
 * Canonical error codes for the Communication System API.
 * All API errors use the envelope: { error: { code, message, requestId, details? } }
 */
export const ERROR_CODES = {
  // -- Auth / Identity --------------------------------------------------------
  UNAUTHORIZED: "UNAUTHORIZED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_WRONG_ISSUER: "TOKEN_WRONG_ISSUER",
  TOKEN_WRONG_AUDIENCE: "TOKEN_WRONG_AUDIENCE",
  TOKEN_UNKNOWN_KID: "TOKEN_UNKNOWN_KID",
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // -- Tenant / Isolation -----------------------------------------------------
  COMPANY_MISMATCH: "COMPANY_MISMATCH",
  NOT_A_MEMBER: "NOT_A_MEMBER",

  // -- Resources -------------------------------------------------------------
  NOT_FOUND: "NOT_FOUND",
  CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ATTACHMENT_NOT_FOUND: "ATTACHMENT_NOT_FOUND",

  // -- Validation -------------------------------------------------------------
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BODY_TOO_LARGE: "BODY_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  INVALID_CURSOR: "INVALID_CURSOR",

  // -- Business logic ---------------------------------------------------------
  DUPLICATE_MESSAGE: "DUPLICATE_MESSAGE",
  MESSAGE_DELETED: "MESSAGE_DELETED",
  CHANNEL_ARCHIVED: "CHANNEL_ARCHIVED",
  ANNOUNCEMENT_ONLY: "ANNOUNCEMENT_ONLY",
  DM_LIMIT_EXCEEDED: "DM_LIMIT_EXCEEDED",
  CANNOT_EDIT_OWN_MESSAGE: "CANNOT_EDIT_OWN_MESSAGE",

  // -- Attachments ------------------------------------------------------------
  UPLOAD_QUOTA_EXCEEDED: "UPLOAD_QUOTA_EXCEEDED",
  FILE_TYPE_NOT_ALLOWED: "FILE_TYPE_NOT_ALLOWED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  CHECKSUM_MISMATCH: "CHECKSUM_MISMATCH",
  ATTACHMENT_SCAN_PENDING: "ATTACHMENT_SCAN_PENDING",
  ATTACHMENT_SCAN_FAILED: "ATTACHMENT_SCAN_FAILED",

  // -- Real-time --------------------------------------------------------------
  WS_AUTH_FAILED: "WS_AUTH_FAILED",
  WS_SUBSCRIPTION_DENIED: "WS_SUBSCRIPTION_DENIED",
  WS_MESSAGE_TOO_LARGE: "WS_MESSAGE_TOO_LARGE",
  WS_RATE_LIMITED: "WS_RATE_LIMITED",

  // -- Rate limiting ----------------------------------------------------------
  RATE_LIMITED: "RATE_LIMITED",

  // -- Webhooks ---------------------------------------------------------------
  WEBHOOK_SIGNATURE_INVALID: "WEBHOOK_SIGNATURE_INVALID",
  WEBHOOK_TIMESTAMP_EXPIRED: "WEBHOOK_TIMESTAMP_EXPIRED",
  WEBHOOK_EVENT_DUPLICATE: "WEBHOOK_EVENT_DUPLICATE",

  // -- System -----------------------------------------------------------------
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** HTTP status codes mapped to error codes */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  TOKEN_WRONG_ISSUER: 401,
  TOKEN_WRONG_AUDIENCE: 401,
  TOKEN_UNKNOWN_KID: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSIONS: 403,
  COMPANY_MISMATCH: 403,
  NOT_A_MEMBER: 403,
  NOT_FOUND: 404,
  CONVERSATION_NOT_FOUND: 404,
  MESSAGE_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  ATTACHMENT_NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  BODY_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INVALID_CURSOR: 422,
  DUPLICATE_MESSAGE: 200,
  MESSAGE_DELETED: 410,
  CHANNEL_ARCHIVED: 409,
  ANNOUNCEMENT_ONLY: 403,
  DM_LIMIT_EXCEEDED: 422,
  CANNOT_EDIT_OWN_MESSAGE: 403,
  UPLOAD_QUOTA_EXCEEDED: 422,
  FILE_TYPE_NOT_ALLOWED: 422,
  FILE_TOO_LARGE: 413,
  CHECKSUM_MISMATCH: 422,
  ATTACHMENT_SCAN_PENDING: 202,
  ATTACHMENT_SCAN_FAILED: 422,
  WS_AUTH_FAILED: 401,
  WS_SUBSCRIPTION_DENIED: 403,
  WS_MESSAGE_TOO_LARGE: 413,
  WS_RATE_LIMITED: 429,
  RATE_LIMITED: 429,
  WEBHOOK_SIGNATURE_INVALID: 401,
  WEBHOOK_TIMESTAMP_EXPIRED: 401,
  WEBHOOK_EVENT_DUPLICATE: 200,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

import { z } from "zod";

/** Standard API error envelope */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
