// Signerad kalenderlänk. Intervju-id ensamt räcker inte längre som nyckel —
// varje länk i ett mejl bär en signatur som bara servern kan räkna ut.
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sig).slice(0, 32);
}

export async function icsSignature(interviewId: string): Promise<string> {
  return await sign(`ics:${interviewId}`);
}

export async function icsUrlFor(supabaseUrl: string, interviewId: string): Promise<string> {
  const sig = await icsSignature(interviewId);
  return `${supabaseUrl}/functions/v1/download-interview-ics?id=${interviewId}&sig=${sig}`;
}

export async function icsSignatureValid(interviewId: string, sig: string | null): Promise<boolean> {
  if (!sig) return false;
  const expected = await icsSignature(interviewId);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
