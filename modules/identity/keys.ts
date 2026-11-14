import { fromBase64, sha256Hex, utf8 } from "@/modules/platform/canonical";

/** ECDSA P-256 with SHA-256; signatures are IEEE P1363 (r‖s), which is what WebCrypto emits on both sides. */
export const SIGN_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
export const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;

export async function keyFingerprint(spkiB64: string): Promise<string> {
  return (await sha256Hex(spkiB64)).slice(0, 16);
}

export async function verifySignature(
  spkiB64: string,
  message: string,
  signatureB64: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("spki", fromBase64(spkiB64), SIGN_ALG, false, ["verify"]);
    return await crypto.subtle.verify(SIGN_PARAMS, key, fromBase64(signatureB64), utf8(message));
  } catch {
    return false;
  }
}

/** Every sensitive action signs a payload of this shape; `ts` bounds replay to a short window. */
export type SignedAction = {
  action: "confirm_session" | "gift_hours" | "accept_cycle" | "cast_vote";
  ts: number;
  [field: string]: string | number | boolean | null;
};

export const SIGNATURE_MAX_AGE_MS = 5 * 60_000;
