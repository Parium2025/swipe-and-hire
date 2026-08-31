type RateLimitClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

interface LimitRule {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  /** Klartext-meddelande som visas för användaren när gränsen nås. */
  message?: string;
}

interface RateLimitReservation {
  allowed: boolean;
  blocked_scope?: string;
  retry_after_seconds?: number;
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function singleHeaderValue(value: string | null): string {
  return (value ?? "").split(",")[0]?.trim().slice(0, 64) ?? "";
}

function lastHeaderValue(value: string | null): string {
  const parts = (value ?? "").split(",");
  return parts.at(-1)?.trim().slice(0, 64) ?? "";
}

export function requestIp(req: Request): string {
  return (
    singleHeaderValue(req.headers.get("cf-connecting-ip")) ||
    singleHeaderValue(req.headers.get("x-real-ip")) ||
    // Proxies append hops to X-Forwarded-For. The last value avoids trusting
    // a caller-prepended value when the Supabase gateway adds the real hop.
    lastHeaderValue(req.headers.get("x-forwarded-for")) ||
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
  const orderedRules = rules
    .map((rule, originalIndex) => ({ rule, originalIndex }))
    .sort((left, right) => {
      const leftPriority = left.rule.scope === "ip" ? 0 : 1;
      const rightPriority = right.rule.scope === "ip" ? 0 : 1;
      return leftPriority - rightPriority || left.originalIndex - right.originalIndex;
    })
    .map(({ rule }) => rule);

  if (orderedRules.length === 0 || orderedRules[0]?.scope !== "ip") {
    console.error("rate limit configuration rejected", { namespace, reason: "missing_ip_rule" });
    return new Response(
      JSON.stringify({ error: "Tjänsten är tillfälligt upptagen. Försök igen om en stund." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const reservations = await Promise.all(
    orderedRules.map(async (rule) => ({
      scope: rule.scope,
      key: `${namespace}:${rule.scope}:${await hashIdentifier(rule.identifier)}`,
      limit: rule.limit,
      window_seconds: rule.windowSeconds,
    })),
  );
  const { data, error } = await client.rpc("reserve_rate_limits", {
    _rules: reservations,
  });

  if (error) {
    console.error("rate limit reservation failed", { namespace, error: error.message });
    return new Response(
      JSON.stringify({ error: "Tjänsten är tillfälligt upptagen. Försök igen om en stund." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const reservation = data as RateLimitReservation | boolean | null;
  const allowed = reservation === true ||
    (typeof reservation === "object" && reservation?.allowed === true);
  if (allowed) return null;

  if (!reservation || typeof reservation !== "object" || reservation.allowed !== false) {
    console.error("rate limit reservation returned an invalid result", { namespace });
    return new Response(
      JSON.stringify({ error: "Tjänsten är tillfälligt upptagen. Försök igen om en stund." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const blockedRule = orderedRules.find((rule) => rule.scope === reservation.blocked_scope) ??
    orderedRules[0];
  const retryAfter = Number.isSafeInteger(reservation.retry_after_seconds) &&
      (reservation.retry_after_seconds ?? 0) > 0
    ? reservation.retry_after_seconds!
    : blockedRule.windowSeconds;
  const minutes = Math.max(1, Math.round(blockedRule.windowSeconds / 60));
  const fallback =
    `Du har gjort för många försök. Av säkerhetsskäl tillåter vi max ${blockedRule.limit} försök per ${minutes} minuter. ` +
    `Vänta en stund och försök igen – ditt konto är helt opåverkat.`;
  return new Response(
    JSON.stringify({ error: blockedRule.message || fallback }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );

}
