"use client";
import { SIGN_ALG, SIGN_PARAMS, type SignedAction } from "@/modules/identity/keys";
import { canonicalJson, toBase64, utf8 } from "@/modules/platform/canonical";

/**
 * The device key. Generated in the browser as a NON-EXTRACTABLE ECDSA P-256 key and stored in IndexedDB as a
 * CryptoKey object: the private key can sign, but it can never be read out, not even by this code.
 */
const DB_NAME = "skillswap";
const STORE = "keys";
const KEY_ID = "device";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown) {
  const db = await idb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let pending: Promise<CryptoKeyPair> | null = null;

export function deviceKey(): Promise<CryptoKeyPair> {
  pending ??= (async () => {
    const existing = await idbGet<CryptoKeyPair>(KEY_ID);
    if (existing?.privateKey) return existing;
    const pair = (await crypto.subtle.generateKey(SIGN_ALG, false, ["sign", "verify"])) as CryptoKeyPair;
    await idbPut(KEY_ID, pair);
    return pair;
  })();
  return pending;
}

export async function publicKeyB64() {
  return toBase64(await crypto.subtle.exportKey("spki", (await deviceKey()).publicKey));
}

export async function signText(text: string) {
  return toBase64(await crypto.subtle.sign(SIGN_PARAMS, (await deviceKey()).privateKey, utf8(text)));
}

/** Sign the exact payload of a sensitive action. The server verifies against this device's public key. */
export async function signAction<A extends SignedAction["action"]>(
  action: A,
  fields: Omit<SignedAction, "action" | "ts">,
) {
  const payload = { ...fields, action, ts: Date.now() } as SignedAction;
  return { payload, signature: await signText(canonicalJson(payload)) };
}
