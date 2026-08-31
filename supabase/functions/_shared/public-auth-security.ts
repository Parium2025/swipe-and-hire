export const DEFAULT_APP_ORIGIN = "https://www.parium.se";

const APPROVED_APP_ORIGINS = new Set([
  DEFAULT_APP_ORIGIN,
  "https://parium.se",
  "https://parium-ab.lovable.app",
  "https://id-preview--09c4e686-17a9-467e-89b1-3cf832371d49.lovable.app",
]);

function parseApprovedUrl(candidate: string): URL | null {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!APPROVED_APP_ORIGINS.has(url.origin)) return null;
    return url;
  } catch {
    return null;
  }
}

export function approvedAppOrigin(candidate?: string | null): string {
  if (!candidate) return DEFAULT_APP_ORIGIN;
  const url = parseApprovedUrl(candidate);
  if (!url || url.pathname !== "/" || url.search || url.hash) {
    return DEFAULT_APP_ORIGIN;
  }
  return url.origin;
}

/**
 * Reads anonymous auth JSON without allowing a chunked request body to grow
 * without bounds. Returning null intentionally keeps malformed and oversized
 * requests on the same non-enumerating public response path.
 */
export async function readBoundedJson<T>(
  req: Request,
  maxBytes = 16_384,
): Promise<T | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes < 0 ||
      declaredBytes > maxBytes
    ) {
      return null;
    }
  }

  if (!req.body) return null;

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("Request body exceeds the permitted size").catch(
          () => undefined,
        );
        return null;
      }
      chunks.push(value);
    }

    if (totalBytes === 0) return null;
    const payload = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      payload.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    return JSON.parse(text) as T;
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** Persist only a one-way digest of bearer-style confirmation capabilities. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function genericPublicAuthResponse(
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Om adressen kan användas skickar vi nästa steg via e-post.",
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

interface PublicAuthResponseFloorOptions {
  minimumMs?: number;
  jitterMs?: number;
  now?: () => number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const secureRandomUnit = (): number => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
};

/**
 * Reduces account-enumeration signal from the valid signup path. This is
 * defense in depth: the stable response body and IP-first rate limit remain
 * the primary controls. Staging must still validate the chosen floor against
 * observed p99 latency.
 */
export async function waitForPublicAuthResponseFloor(
  startedAtMs: number,
  options: PublicAuthResponseFloorOptions = {},
): Promise<void> {
  const minimumMs = Math.max(0, options.minimumMs ?? 1_200);
  const jitterMs = Math.max(0, options.jitterMs ?? 200);
  const now = options.now ?? (() => performance.now());
  const random = options.random ?? secureRandomUnit;
  const sleep = options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const boundedRandom = Math.min(1, Math.max(0, random()));
  const targetMs = minimumMs + Math.floor(boundedRandom * jitterMs);
  const remainingMs = Math.max(0, targetMs - Math.max(0, now() - startedAtMs));

  if (remainingMs > 0) {
    await sleep(remainingMs);
  }
}

type EdgeRuntimeLike = {
  waitUntil: (promise: Promise<unknown>) => void;
};

/**
 * Keeps a public auth response independent of database/mail latency. Supabase
 * Edge Runtime exposes waitUntil; the fallback still starts the task for local
 * and compatible runtimes while reporting that durable scheduling was absent.
 */
export function runAuthBackgroundTask(
  label: string,
  operation: () => Promise<void>,
): boolean {
  const task = Promise.resolve()
    .then(operation)
    .catch((error: unknown) => {
      console.error(`${label} background task failed`, {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    });

  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(task);
    return true;
  }

  void task;
  return false;
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = 10_000,
  message = "Operation timed out",
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(message);
      error.name = "TimeoutError";
      reject(error);
    }, Math.max(1, timeoutMs));
  });

  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      timeoutPromise,
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

const SIGNUP_STRING_LIMITS = {
  first_name: 100,
  last_name: 100,
  phone: 30,
  company_name: 200,
  org_number: 64,
  industry: 120,
  address: 160,
  website: 200,
  company_description: 3_000,
  employee_count: 50,
  policy_version: 64,
  dpa_version: 64,
} as const;

const CURRENT_PRIVACY_POLICY_VERSION = "2026-01";
const CURRENT_DPA_VERSION = "2026-01";
const EMPLOYEE_COUNT_VALUES = new Map([
  ["1-10", "1-10 anställda"],
  ["1-10 anställda", "1-10 anställda"],
  ["11-50", "11-50 anställda"],
  ["11-50 anställda", "11-50 anställda"],
  ["51-200", "51-200 anställda"],
  ["51-200 anställda", "51-200 anställda"],
  ["201-500", "201-500 anställda"],
  ["201-500 anställda", "201-500 anställda"],
  ["500+", "500+ anställda"],
  ["500+ anställda", "500+ anställda"],
]);

type SignupStringKey = keyof typeof SIGNUP_STRING_LIMITS;

function boundedString(
  value: unknown,
  maxLength: number,
  required = false,
): string | undefined | null {
  if (value === undefined || value === null) return required ? null : undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return required ? null : undefined;
  if (normalized.length > maxLength) return null;
  return normalized;
}

export function isValidPublicSignupEmail(value: string): boolean {
  return value.length > 0 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPublicSignupPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function isPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalized.includes(".")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) return false;
  if (normalized.includes(":")) return false;
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".lan") ||
    normalized.endsWith(".home") ||
    normalized.endsWith(".test") ||
    normalized.endsWith(".invalid") ||
    normalized.endsWith(".example")
  ) {
    return false;
  }
  return !normalized.startsWith(".") && !normalized.endsWith(".");
}

function isValidPublicWebsite(value: string): boolean {
  try {
    const url = new URL(value);
    const isWebProtocol = url.protocol === "https:" || url.protocol === "http:";
    const hasPublicHostname = isPublicHostname(url.hostname);
    return isWebProtocol && hasPublicHostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function normalizeSwedishMobile(value: string): string | null {
  const compact = value.replace(/[^\d+]/g, "");
  let national = "";

  if (/^\+46\d{9}$/.test(compact)) national = compact.slice(3);
  else if (/^0046\d{9}$/.test(compact)) national = compact.slice(4);
  else if (/^0\d{9}$/.test(compact)) national = compact.slice(1);
  else if (/^\d{9}$/.test(compact)) national = compact;
  else return null;

  return /^7[0-6]\d{7}$/.test(national) ? `+46${national}` : null;
}

/** Only returns metadata fields that the current public signup contract owns. */
export function sanitizeSignupMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, string> | null {
  if (!input) return null;
  const role = input.role;
  if (role !== "job_seeker" && role !== "employer") return null;

  const termsValue = boundedString(input.terms_accepted_at, 64, true);
  const policyVersion = boundedString(
    input.policy_version,
    SIGNUP_STRING_LIMITS.policy_version,
    true,
  );
  const dpaVersion = boundedString(
    input.dpa_version,
    SIGNUP_STRING_LIMITS.dpa_version,
    role === "employer",
  );
  const firstName = boundedString(
    input.first_name,
    SIGNUP_STRING_LIMITS.first_name,
    true,
  );
  const lastName = boundedString(
    input.last_name,
    SIGNUP_STRING_LIMITS.last_name,
    true,
  );

  if (!termsValue || !policyVersion || !firstName || !lastName) return null;
  if (role === "employer" && !dpaVersion) return null;
  if (policyVersion !== CURRENT_PRIVACY_POLICY_VERSION) return null;
  if (dpaVersion && dpaVersion !== CURRENT_DPA_VERSION) return null;

  const acceptedAt = Date.parse(termsValue);
  const now = Date.now();
  if (!Number.isFinite(acceptedAt)) return null;
  if (acceptedAt > now + 5 * 60_000 || acceptedAt < now - 24 * 60 * 60_000) return null;

  const result: Record<string, string> = {
    role,
    first_name: firstName,
    last_name: lastName,
    // The client proves that it submitted a consent action, but does not
    // choose the authoritative audit timestamp. The DB trigger records its
    // own clock as well, keeping consent_records server-authored end to end.
    terms_accepted_at: new Date(now).toISOString(),
    policy_version: policyVersion,
  };
  if (role === "employer" && dpaVersion) result.dpa_version = dpaVersion;

  const roleFields = role === "employer"
    ? new Set<SignupStringKey>([
      "company_name",
      "org_number",
      "industry",
      "address",
      "website",
      "company_description",
      "employee_count",
    ])
    : new Set<SignupStringKey>(["phone"]);

  for (const key of Object.keys(SIGNUP_STRING_LIMITS) as SignupStringKey[]) {
    if (key === "first_name" || key === "last_name" || key === "policy_version" || key === "dpa_version") {
      continue;
    }
    if (!roleFields.has(key)) continue;
    const value = boundedString(input[key], SIGNUP_STRING_LIMITS[key]);
    if (value === null) return null;
    if (value !== undefined) result[key] = value;
  }

  if (result.website && !isValidPublicWebsite(result.website)) return null;

  if (role === "job_seeker") {
    if (!result.phone) return null;
    const normalizedPhone = normalizeSwedishMobile(result.phone);
    if (!normalizedPhone) return null;
    result.phone = normalizedPhone;
  }
  if (
    role === "employer" &&
    (!result.company_name || !result.industry || !result.address ||
      !result.website || !result.employee_count)
  ) {
    return null;
  }
  if (role === "employer") {
    const canonicalEmployeeCount = EMPLOYEE_COUNT_VALUES.get(result.employee_count);
    if (!canonicalEmployeeCount) return null;
    result.employee_count = canonicalEmployeeCount;
  }
  return result;
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, Math.max(1, timeoutMs));

  const abortFromCaller = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (init.signal?.aborted) abortFromCaller();

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}
