import { jwtVerify, SignJWT } from "jose";
import { appSecret, hmacHex, timingSafeEqual } from "@/modules/platform/secret";

export const SESSION_COOKIE = "ss_session";
/** Short life with rotation: tokens live 7 days and are reissued once they are a day old. */
export const SESSION_TTL_S = 7 * 24 * 3600;
export const SESSION_ROTATE_S = 24 * 3600;
export const CHALLENGE_TTL_MS = 2 * 60_000;

export type SessionClaims = { memberId: string; deviceId: string; issuedAt: number };

const key = () => new TextEncoder().encode(appSecret());

export async function issueSessionToken(memberId: string, deviceId: string): Promise<string> {
  return new SignJWT({ did: deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(key());
}

export async function readSessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.did !== "string") return null;
    return { memberId: payload.sub, deviceId: payload.did, issuedAt: payload.iat ?? 0 };
  } catch {
    return null;
  }
}

/** Stateless challenge: `v1.<nonce>.<expiry>.<hmac>`. The device signs this exact string. */
export async function createChallenge(now = Date.now()): Promise<string> {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const exp = now + CHALLENGE_TTL_MS;
  const body = `v1.${nonce}.${exp}`;
  return `${body}.${await hmacHex(body)}`;
}

export async function checkChallenge(challenge: string, now = Date.now()): Promise<boolean> {
  const parts = challenge.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const body = parts.slice(0, 3).join(".");
  if (!timingSafeEqual(await hmacHex(body), parts[3])) return false;
  return Number(parts[2]) > now;
}
