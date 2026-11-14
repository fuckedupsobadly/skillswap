import { and, eq } from "drizzle-orm";
import type { DB, Q } from "@/db/client";
import { botKeys, devices, members } from "@/db/schema";
import { grantStarterHours, memberAccount } from "@/modules/ledger/service";
import { canonicalJson, toBase64, utf8 } from "@/modules/platform/canonical";
import { DomainError } from "@/modules/platform/errors";
import { emit } from "@/modules/platform/outbox";
import {
  keyFingerprint,
  SIGN_ALG,
  SIGN_PARAMS,
  SIGNATURE_MAX_AGE_MS,
  type SignedAction,
  verifySignature,
} from "./keys";
import { checkChallenge } from "./session";

const ADJECTIVES = ["calm", "bright", "steady", "quick", "kind", "bold", "quiet", "keen", "warm", "clear"];
const NOUNS = [
  "otter",
  "maple",
  "comet",
  "harbor",
  "falcon",
  "cedar",
  "river",
  "lantern",
  "orchid",
  "summit",
];

function guestHandle() {
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${ADJECTIVES[r[0] % ADJECTIVES.length]}-${NOUNS[r[1] % NOUNS.length]}-${(r[2] % 9000) + 1000}`;
}

/**
 * Sign in with a device key. The browser proves it holds the private key by signing a server challenge.
 * A key we haven't seen becomes a new guest: member + device + account + a 2 h starter grant on the ledger.
 */
export async function signInWithDevice(
  db: DB,
  input: { publicKey: string; challenge: string; signature: string; timezone?: string },
) {
  if (!(await checkChallenge(input.challenge)))
    throw new DomainError("bad_signature", "Challenge expired. Try again.");
  if (!(await verifySignature(input.publicKey, input.challenge, input.signature))) {
    throw new DomainError("bad_signature", "Device signature did not verify.");
  }
  const [known] = await db.select().from(devices).where(eq(devices.publicKey, input.publicKey));
  if (known) {
    await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, known.id));
    return { memberId: known.memberId, deviceId: known.id, created: false };
  }
  const fingerprint = await keyFingerprint(input.publicKey);
  const tz = isValidTimezone(input.timezone) ? input.timezone! : "UTC";
  return db.transaction(async (tx) => {
    const handle = guestHandle();
    const [m] = await tx
      .insert(members)
      .values({
        handle,
        displayName: handle.split("-").slice(0, 2).map(cap).join(" "),
        timezone: tz,
        languages: ["English"],
      })
      .returning();
    const [d] = await tx
      .insert(devices)
      .values({ memberId: m.id, publicKey: input.publicKey, fingerprint })
      .returning();
    await memberAccount(tx, m.id);
    await grantStarterHours(tx, m.id);
    await emit(tx, "member.joined", { memberId: m.id });
    return { memberId: m.id, deviceId: d.id, created: true };
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function isValidTimezone(tz: string | undefined): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sensitive actions (confirming a session, gifting hours, accepting a cycle) need a fresh device signature over
 * the exact payload. Returns what to store as evidence.
 */
export async function verifyAction(
  q: Q,
  deviceId: string,
  memberId: string,
  payload: SignedAction,
  signature: string,
  expect: Partial<SignedAction> & { action: SignedAction["action"] },
) {
  for (const [k, v] of Object.entries(expect)) {
    if (payload[k] !== v) throw new DomainError("bad_signature", `Signed payload does not match (${k}).`);
  }
  if (Math.abs(Date.now() - payload.ts) > SIGNATURE_MAX_AGE_MS) {
    throw new DomainError("bad_signature", "Signature is too old. Try again.");
  }
  const [device] = await q
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.memberId, memberId)));
  if (!device) throw new DomainError("forbidden", "Unknown device.");
  const message = canonicalJson(payload);
  if (!(await verifySignature(device.publicKey, message, signature))) {
    throw new DomainError("bad_signature", "Device signature did not verify.");
  }
  return { message, signature, signerKey: device.fingerprint };
}

/** Labelled sample members sign with server-held keys so their automatic actions are verifiable like anyone's. */
export async function botSign(q: Q, memberId: string, payload: SignedAction) {
  const [k] = await q.select().from(botKeys).where(eq(botKeys.memberId, memberId));
  if (!k) throw new DomainError("forbidden", "Not a sample member.");
  const key = await crypto.subtle.importKey("jwk", k.privateJwk as JsonWebKey, SIGN_ALG, false, ["sign"]);
  const message = canonicalJson(payload);
  const signature = toBase64(await crypto.subtle.sign(SIGN_PARAMS, key, utf8(message)));
  return { deviceId: k.deviceId, signature, payload };
}

/** Create a key pair for a sample member at seed time. */
export async function createBotIdentity(q: Q, memberId: string) {
  const pair = (await crypto.subtle.generateKey(SIGN_ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const spki = toBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const [d] = await q
    .insert(devices)
    .values({ memberId, publicKey: spki, fingerprint: await keyFingerprint(spki) })
    .returning();
  await q.insert(botKeys).values({ memberId, deviceId: d.id, privateJwk: jwk });
  return d.id;
}
