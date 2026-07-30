type RateLimitClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

interface LimitRule {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function firstHeaderValue(value: string | null): string {
  return (value ?? "").split(",")[0]?.trim() ?? "";
}

export function requestIp(req: Request): string {
  return (
    firstHeaderValue(req.headers.get("cf-connecting-ip")) ||
    firstHeaderValue(req.headers.get("x-forwarded-for")) ||
    firstHeaderValue(req.headers.get("x-real-ip")) ||
    "unknown"
  );
}

async function hashIdentifier(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit(
  client: RateLimitClient,
  namespace: string,
  rules: LimitRule[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  for (const rule of rules) {
    const key = `${namespace}:${rule.scope}:${await hashIdentifier(rule.identifier)}`;
    const { data, error } = await client.rpc("consume_rate_limit", {
      _key: key,
      _limit: rule.limit,
      _window_seconds: rule.windowSeconds,
    });

    if (error) {
      console.error("rate limit check failed", { namespace, scope: rule.scope, error: error.message });
      return new Response(
        JSON.stringify({ error: "Tjänsten är tillfälligt upptagen. Försök igen om en stund." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (data !== true) {
      return new Response(
        JSON.stringify({ error: "För många försök. Vänta en stund och försök igen." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rule.windowSeconds) } },
      );
    }
  }

  return null;
}