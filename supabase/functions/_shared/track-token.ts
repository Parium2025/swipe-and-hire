// Delad hemlighet för öppningsspårnings-URL:er (outreach-open-track).
// Token härleds ur service-roll-nyckeln som bara finns på servern, så en
// utomstående kan inte gissa giltiga token även om de känner till ett
// logg-ID från ett vidarebefordrat mejl.
export const computeTrackingToken = async (logId: string): Promise<string> => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const data = new TextEncoder().encode(`${logId}|${key}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
};
