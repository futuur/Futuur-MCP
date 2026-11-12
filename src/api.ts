import { createHmac } from "node:crypto";

import { VERSION } from "./version.js";

export const DEFAULT_BASE_URL = "https://api.futuur.com/v2.0/";
export const USER_AGENT = `futuur-mcp/${VERSION} (+https://github.com/futuur/Futuur-MCP)`;
const TIMEOUT_MS = 30_000;

export type Primitive = string | number | boolean | null | undefined;
export type Query = Record<string, Primitive | Primitive[]>;
export type Body = Record<string, unknown>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Query;
  body?: Body;
  /**
   * "required": fail early when no API keys are configured.
   * "optional" (default): sign when keys are configured, otherwise call anonymously.
   */
  auth?: "required" | "optional";
}

/** An error response from the Futuur API, or a failure to reach it. */
export class FutuurApiError extends Error {
  constructor(message: string, readonly status?: number, readonly detail?: unknown) {
    super(message);
    this.name = "FutuurApiError";
  }
}

export function baseUrl(): string {
  const raw = (process.env.FUTUUR_API_BASE_URL || DEFAULT_BASE_URL).trim();
  return raw.endsWith("/") ? raw : raw + "/";
}

function keys(): { key: string; secret: string } | null {
  const key = process.env.FUTUUR_PUBLIC_KEY?.trim();
  const secret = process.env.FUTUUR_PRIVATE_KEY?.trim();
  return key && secret ? { key, secret } : null;
}

export function hasKeys(): boolean {
  return keys() !== null;
}

/**
 * Python's str() for a JSON value. The API signs `urlencode(sorted(params))` over the parsed
 * request, so values must be rendered the way Python renders them (True/False/None, repr for
 * containers), not the way JavaScript does.
 */
export function pyStr(value: unknown, nested = false): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return pyNumber(value);
  if (typeof value === "string") {
    if (!nested) return value;
    return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }
  if (Array.isArray(value)) return "[" + value.map((v) => pyStr(v, true)).join(", ") + "]";
  if (typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${pyStr(k, true)}: ${pyStr(v, true)}`).join(", ") + "}";
  }
  return String(value);
}

/** Python's repr of a JSON number: floats switch to exponent form below 1e-4 and from 1e16, as `1e-05`. */
function pyNumber(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e16) return String(value);
  const abs = Math.abs(value);
  if (abs >= 1e-4 && abs < 1e16) return String(value);
  const [mantissa, exponent] = value.toExponential().split("e");
  const digits = exponent.replace(/^[+-]/, "").padStart(2, "0");
  return `${mantissa}e${exponent.startsWith("-") ? "-" : "+"}${digits}`;
}

/** Python's urllib.parse.quote_plus: unreserved = letters, digits and `_.-~`; space becomes `+`. */
export function quotePlus(text: string): string {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

/** The string the API signs: every body field and query parameter plus Key and Timestamp, sorted by name. */
export function signingString(params: Record<string, unknown>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${quotePlus(k)}=${quotePlus(pyStr(params[k]))}`)
    .join("&");
}

export function sign(params: Record<string, unknown>, secret: string): string {
  return createHmac("sha512", secret).update(signingString(params), "utf8").digest("hex");
}

export function authHeaders(
  signed: Record<string, unknown>,
  now: number = Math.floor(Date.now() / 1000),
): Record<string, string> {
  const k = keys();
  if (!k) {
    throw new FutuurApiError(
      "This tool needs Futuur API keys. Set FUTUUR_PUBLIC_KEY and FUTUUR_PRIVATE_KEY " +
        "(futuur.com → Settings → API keys) in the MCP server configuration.",
    );
  }
  return {
    Key: k.key,
    Timestamp: String(now),
    HMAC: sign({ ...signed, Key: k.key, Timestamp: now }, k.secret),
  };
}

/** Drops undefined/null entries; arrays become comma-separated values (how the API takes lists). */
function cleanQuery(query: Query | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const items = value.filter((v) => v !== undefined && v !== null);
      if (items.length) out[name] = items.map(String).join(",");
    } else {
      out[name] = String(value);
    }
  }
  return out;
}

function cleanBody(body: Body | undefined): Body | undefined {
  if (!body) return undefined;
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

function describe(status: number, detail: unknown): string {
  let text: string;
  if (typeof detail === "string") text = detail.slice(0, 500);
  else if (detail && typeof detail === "object") text = JSON.stringify(detail).slice(0, 1500);
  else text = "";
  const hint =
    status === 401 || status === 403
      ? " Check that FUTUUR_PUBLIC_KEY / FUTUUR_PRIVATE_KEY are valid and active, and that the system clock is correct."
      : status === 429
        ? " Rate limit reached; wait before retrying."
        : "";
  return `Futuur API returned ${status}${text ? `: ${text}` : ""}.${hint}`;
}

/**
 * Call the Futuur public API. `endpoint` is relative to the base URL, e.g. "events/" or
 * `orders/${id}/cancel/`. Returns the parsed JSON body (null for an empty response).
 */
export async function futuur<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const query = cleanQuery(options.query);
  const body = cleanBody(options.body);
  const url = new URL(endpoint.replace(/^\/+/, ""), baseUrl());
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);

  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "application/json" };
  if (options.auth === "required" || hasKeys()) {
    Object.assign(headers, authHeaders({ ...(body ?? {}), ...query }));
  }
  if (body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FutuurApiError(`Could not reach the Futuur API (${method} ${url.pathname}): ${reason}`);
  }

  const raw = await response.text();
  let parsed: unknown = raw;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* non-JSON body (e.g. an HTML error page): keep the text */
    }
  }
  if (!response.ok) throw new FutuurApiError(describe(response.status, parsed), response.status, parsed);
  return (raw ? parsed : null) as T;
}
