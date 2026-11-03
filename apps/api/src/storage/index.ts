import { createHmac, createHash } from "node:crypto";
import { env } from "../env.js";

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function hexHmac(key: string | Buffer, data: string): string {
  return createHmac("sha256", key).update(data, "utf8").digest("hex");
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function generatePresignedUrl(opts: {
  method: "GET" | "PUT";
  storageKey: string;
  expiresInSeconds?: number;
}): { url: string; expiresAt: string } {
  const expiresIn = opts.expiresInSeconds ?? 3600;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

  const endpointUrl = new URL(env.STORAGE_ENDPOINT);
  const host = endpointUrl.host;
  const bucket = env.STORAGE_BUCKET;
  const region = env.STORAGE_REGION;
  const accessKey = env.STORAGE_ACCESS_KEY;
  const secretKey = env.STORAGE_SECRET_KEY;

  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${yyyymmdd}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const credentialScope = `${yyyymmdd}/${region}/s3/aws4_request`;

  const canonicalUri = `/${bucket}/${encodeURIComponent(opts.storageKey).replace(/%2F/g, "/")}`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };

  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, yyyymmdd);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hexHmac(kSigning, stringToSign);

  const fullUrl = `${env.STORAGE_ENDPOINT}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  return { url: fullUrl, expiresAt };
}
