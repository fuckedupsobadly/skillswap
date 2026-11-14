/** APP_SECRET signs session cookies and challenges. Production refuses to start without one. */
let warned = false;

export function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production" && process.env.SKILLSWAP_ALLOW_DEV_SECRET !== "1") {
    throw new Error("APP_SECRET (32+ characters) is required in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[skillswap] APP_SECRET not set — using an insecure development secret");
  }
  return "dev-only-insecure-secret-change-me-0123456789";
}

const enc = new TextEncoder();

export async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(appSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
