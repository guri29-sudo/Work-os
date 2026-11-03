/**
 * Attachments repository for multi-tenant file attachment lifecycle.
 */
import { eq, and } from "drizzle-orm";
import { attachments } from "../db/schema/index.js";
import { withTenantTx, type Db } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";

export interface CreateAttachmentInput {
  id?: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  storage_key: string;
}

export const attachmentsRepo = {
  async createPending(
    identity: RequestIdentity,
    input: CreateAttachmentInput,
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const [record] = await tx
        .insert(attachments)
        .values({
          id: input.id,
          company_id: identity.companyId,
          uploader_id: identity.userId,
          filename: input.filename,
          mime_type: input.mime_type,
          size_bytes: input.size_bytes,
          checksum_sha256: input.checksum_sha256,
          storage_key: input.storage_key,
          scan_status: "pending",
        })
        .returning();
      return record;
    });
  },

  async getById(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [record] = await tx
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.id, id),
            eq(attachments.company_id, identity.companyId),
          ),
        );
      return record ?? null;
    });
  },

  async finalize(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [record] = await tx
        .update(attachments)
        .set({ scan_status: "clean" })
        .where(
          and(
            eq(attachments.id, id),
            eq(attachments.company_id, identity.companyId),
          ),
        )
        .returning();
      return record ?? null;
    });
  },
};
