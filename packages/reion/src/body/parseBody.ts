import type { IncomingMessage } from "node:http";

const DEFAULT_MAX_BODY_SIZE = 1_000_000; // 1MB

export type ParseBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; body: unknown };

const PAYLOAD_TOO_LARGE = new Error("Payload too large");

function readStream(req: IncomingMessage, maxSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const contentLength = req.headers["content-length"];
    const length = contentLength ? parseInt(contentLength, 10) : null;
    if (length !== null && (isNaN(length) || length < 0 || length > maxSize)) {
      reject(PAYLOAD_TOO_LARGE);
      return;
    }
    if (length === 0) {
      resolve(Buffer.allocUnsafe(0));
      return;
    }
    if (length !== null && length <= maxSize) {
      const buf = Buffer.allocUnsafe(length);
      let offset = 0;
      req.on("data", (chunk: Buffer) => {
        const toCopy = Math.min(chunk.length, length - offset);
        chunk.copy(buf, offset, 0, toCopy);
        offset += toCopy;
        if (offset > maxSize) {
          req.destroy();
          reject(PAYLOAD_TOO_LARGE);
        }
      });
      req.on("end", () => resolve(buf.subarray(0, offset)));
      req.on("error", reject);
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxSize) {
        req.destroy();
        reject(PAYLOAD_TOO_LARGE);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJson(buf: Buffer): unknown {
  if (buf.length === 0) return null;
  const raw = buf.toString("utf-8");
  return JSON.parse(raw);
}

function parseUrlEncoded(buf: Buffer): Record<string, string> {
  if (buf.length === 0) return {};
  const raw = buf.toString("utf-8");
  const out: Record<string, string> = {};
  let start = 0;
  while (start < raw.length) {
    const amp = raw.indexOf("&", start);
    const end = amp === -1 ? raw.length : amp;
    const eq = raw.indexOf("=", start);
    const keyEnd = eq === -1 || eq > end ? end : eq;
    const keyRaw = raw.slice(start, keyEnd);
    const valueRaw = keyEnd === end ? "" : raw.slice(keyEnd + 1, end);
    const key = keyRaw.includes("+")
      ? decodeURIComponent(keyRaw.replaceAll("+", " "))
      : keyRaw.includes("%")
        ? decodeURIComponent(keyRaw)
        : keyRaw;
    const value = valueRaw.includes("+")
      ? decodeURIComponent(valueRaw.replaceAll("+", " "))
      : valueRaw.includes("%")
        ? decodeURIComponent(valueRaw)
        : valueRaw;
    out[key] = value;
    start = amp === -1 ? raw.length : amp + 1;
  }
  return out;
}

function getContentType(req: IncomingMessage): string | null {
  const raw = req.headers["content-type"];
  if (!raw || typeof raw !== "string") return null;
  const part = raw.split(";")[0];
  return part ? part.trim().toLowerCase() : null;
}

export async function parseBody(
  req: IncomingMessage,
  maxBodySize: number = DEFAULT_MAX_BODY_SIZE
): Promise<ParseBodyResult> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return { ok: true, body: null };
  }
  const contentLength = req.headers["content-length"];
  if (contentLength === "0" || contentLength === undefined) {
    return { ok: true, body: null };
  }

  let buffer: Buffer;
  try {
    buffer = await readStream(req, maxBodySize);
  } catch (err) {
    const message = err === PAYLOAD_TOO_LARGE ? "Payload too large" : "Bad request";
    return { ok: false, status: 413, body: { error: message } };
  }

  const contentType = getContentType(req);
  if (!contentType || buffer.length === 0) {
    return { ok: true, body: null };
  }

  if (contentType === "application/json") {
    try {
      const body = parseJson(buffer);
      return { ok: true, body };
    } catch {
      return { ok: false, status: 400, body: { error: "Invalid JSON" } };
    }
  }

  if (contentType === "application/x-www-form-urlencoded") {
    const body = parseUrlEncoded(buffer);
    return { ok: true, body };
  }

  return { ok: true, body: buffer };
}
