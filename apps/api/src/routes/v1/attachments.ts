import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  RequestUploadUrlRequestSchema,
  FinalizeAttachmentRequestSchema,
  PERMISSIONS,
} from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { attachmentsRepo } from "../../repositories/attachments.js";
import { generatePresignedUrl } from "../../storage/index.js";

export default async function attachmentRoutes(fastify: FastifyInstance) {
  fastify.post("/v1/attachments/upload-url", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MESSAGE_SEND);

    const body = RequestUploadUrlRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const attachmentId = randomUUID();
    const safeFilename = body.data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${identity.companyId}/${attachmentId}/${safeFilename}`;

    const presigned = generatePresignedUrl({
      method: "PUT",
      storageKey,
      expiresInSeconds: 3600,
    });

    await attachmentsRepo.createPending(identity, {
      id: attachmentId,
      filename: body.data.filename,
      mime_type: body.data.mime_type,
      size_bytes: body.data.size_bytes,
      checksum_sha256: body.data.checksum_sha256,
      storage_key: storageKey,
    });

    return reply.send({
      attachment_id: attachmentId,
      upload_url: presigned.url,
      upload_expires_at: presigned.expiresAt,
    });
  });

  fastify.post("/v1/attachments/finalize", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MESSAGE_SEND);

    const body = FinalizeAttachmentRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const finalized = await attachmentsRepo.finalize(identity, body.data.attachment_id);
    if (!finalized) {
      return reply
        .status(404)
        .send({ error: { code: "NOT_FOUND", message: "Attachment not found" } });
    }

    return reply.send({ data: finalized });
  });

  fastify.get("/v1/attachments/:id/download-url", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const attachment = await attachmentsRepo.getById(identity, id);
    if (!attachment) {
      return reply
        .status(404)
        .send({ error: { code: "NOT_FOUND", message: "Attachment not found" } });
    }

    const presigned = generatePresignedUrl({
      method: "GET",
      storageKey: attachment.storage_key,
      expiresInSeconds: 3600,
    });

    return reply.send({
      data: {
        download_url: presigned.url,
        expires_at: presigned.expiresAt,
      },
    });
  });
}
