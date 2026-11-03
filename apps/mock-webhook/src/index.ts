/**
 * Mock webhook receiver.
 *
 * Receives webhook deliveries, verifies HMAC-SHA256 signatures,
 * enforces timestamp replay protection (5 minute window),
 * deduplicates by event_id, and logs all received events.
 *
 * Endpoints:
 *   POST /webhook           – Main receiver
 *   GET  /events            – List received events (in-memory)
 *   DELETE /events          – Clear event log
 *   GET  /health            – Health check
 */
import http from "http";
import crypto from "crypto";

const PORT = parseInt(process.env["MOCK_WEBHOOK_PORT"] ?? "4002", 10);
const SIGNING_SECRET =
  process.env["WEBHOOK_SIGNING_SECRET"] ??
  "dev_webhook_signing_secret_change_in_production";

/** Max age of a webhook timestamp (seconds) */
const MAX_TIMESTAMP_AGE_SECONDS = 300;

interface ReceivedEvent {
  event_id: string;
  event_type: string;
  delivery_id: string;
  received_at: string;
  payload: unknown;
  signature_valid: boolean;
}

const receivedEvents: ReceivedEvent[] = [];
const seenEventIds = new Set<string>();

function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedHeader = `sha256=${expected}`;
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedHeader),
    );
  } catch {
    return false;
  }
}

function verifyTimestamp(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const age = Math.floor(Date.now() / 1000) - ts;
  return age >= 0 && age <= MAX_TIMESTAMP_AGE_SECONDS;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const urlObj = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = urlObj.pathname;
  const method = req.method ?? "GET";

  if (path === "/health" && method === "GET") {
    json(res, 200, {
      status: "ok",
      service: "mock-webhook",
      received_count: receivedEvents.length,
    });
    return;
  }

  if (path === "/events" && method === "GET") {
    json(res, 200, { events: receivedEvents });
    return;
  }

  if (path === "/events" && method === "DELETE") {
    receivedEvents.length = 0;
    seenEventIds.clear();
    json(res, 200, { message: "Event log cleared" });
    return;
  }

  if (path === "/webhook" && method === "POST") {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-signature"] as string | undefined;
    const timestamp = req.headers["x-timestamp"] as string | undefined;
    const eventId = req.headers["x-event-id"] as string | undefined;
    const eventType = req.headers["x-event-type"] as string | undefined;
    const deliveryId = req.headers["x-delivery-id"] as string | undefined;

    // Validate required headers
    if (!signature || !timestamp || !eventId || !eventType || !deliveryId) {
      console.error("[mock-webhook] Missing required headers");
      json(res, 400, { error: "Missing required webhook headers" });
      return;
    }

    // Timestamp replay protection
    if (!verifyTimestamp(timestamp)) {
      console.error(
        `[mock-webhook] Timestamp too old or invalid: ${timestamp}`,
      );
      json(res, 401, { error: "Timestamp expired or invalid" });
      return;
    }

    // Signature verification
    const sigValid = verifySignature(rawBody, timestamp, signature);
    if (!sigValid) {
      console.error("[mock-webhook] Signature verification failed");
    }

    // Event-id deduplication
    if (seenEventIds.has(eventId)) {
      console.error(`[mock-webhook] Duplicate event_id: ${eventId}`);
      json(res, 200, { message: "Duplicate event acknowledged" });
      return;
    }
    seenEventIds.add(eventId);

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = rawBody;
    }

    const event: ReceivedEvent = {
      event_id: eventId,
      event_type: eventType,
      delivery_id: deliveryId,
      received_at: new Date().toISOString(),
      payload,
      signature_valid: sigValid,
    };
    receivedEvents.push(event);

    console.error(
      `[mock-webhook] ? Received ${eventType} (${eventId}) sig_valid=${sigValid}`,
    );
    json(res, 200, { message: "Accepted", event_id: eventId });
    return;
  }

  json(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    console.error("[mock-webhook] Error:", err);
    if (!res.headersSent) json(res, 500, { error: "Internal error" });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.error(
    `[mock-webhook] ??  DEV ONLY – Mock webhook receiver on http://0.0.0.0:${PORT}`,
  );
  console.error(`[mock-webhook] Endpoint: POST http://localhost:${PORT}/webhook`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
