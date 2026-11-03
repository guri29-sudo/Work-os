/**
 * Permission constants for the Communication System.
 * These correspond to JWT claims in the `permissions[]` array.
 *
 * All permissions are namespaced under `communication.*` to avoid
 * collisions with other WorkOS services.
 */

export const PERMISSIONS = {
  /** Base access � required for any system interaction */
  ACCESS: "communication.access",

  /** Create public/department/project channels */
  CHANNEL_CREATE: "communication.channel.create",

  /** Create private channels (restricted visibility) */
  PRIVATE_CHANNEL_CREATE: "communication.private_channel.create",

  /** Edit channel name, topic, kind; pin messages */
  CHANNEL_MANAGE: "communication.channel.manage",

  /** Add/remove members, change member roles */
  MEMBER_MANAGE: "communication.member.manage",

  /** Post messages in channels/DMs */
  MESSAGE_SEND: "communication.message.send",

  /**
   * Soft-delete or restore any member's message.
   * Moderators cannot read private DM content; only delete by ID.
   */
  MESSAGE_MODERATE: "communication.message.moderate",

  /** Post to announcement-only channels */
  ANNOUNCEMENT_PUBLISH: "communication.announcement.publish",

  /** Read the audit log (own company only) */
  AUDIT_READ: "communication.audit.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** All permission strings as a tuple for Zod enum */
export const PERMISSION_VALUES = Object.values(PERMISSIONS) as [Permission, ...Permission[]];

/**
 * RBAC role ? default permissions map.
 * Actual permissions come from JWT claims, this is informational.
 */
export const ROLE_DEFAULTS = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.ACCESS,
    PERMISSIONS.CHANNEL_CREATE,
    PERMISSIONS.PRIVATE_CHANNEL_CREATE,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.MEMBER_MANAGE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_MODERATE,
    PERMISSIONS.ANNOUNCEMENT_PUBLISH,
    PERMISSIONS.AUDIT_READ,
  ] as Permission[],
  member: [
    PERMISSIONS.ACCESS,
    PERMISSIONS.CHANNEL_CREATE,
    PERMISSIONS.MESSAGE_SEND,
  ] as Permission[],
  guest: [PERMISSIONS.ACCESS, PERMISSIONS.MESSAGE_SEND] as Permission[],
  bot: [
    PERMISSIONS.ACCESS,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.ANNOUNCEMENT_PUBLISH,
  ] as Permission[],
} as const satisfies Record<string, Permission[]>;

export type RoleKey = keyof typeof ROLE_DEFAULTS;
