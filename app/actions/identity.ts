"use server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { Result } from "@/app/_lib/run";
import { getDb } from "@/db/client";
import { signInWithDevice } from "@/modules/identity/service";
import {
  createChallenge,
  issueSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_S,
} from "@/modules/identity/session";
import { DomainError } from "@/modules/platform/errors";
import { rateLimit } from "@/modules/platform/rate-limit";

/** Never throws to the client: a thrown server action reaches the browser as an opaque minified React error. */
export async function getChallenge(): Promise<Result<string>> {
  try {
    return { ok: true, data: await createChallenge() };
  } catch (e) {
    console.error("[getChallenge]", e);
    return {
      ok: false,
      error:
        e instanceof Error && e.message.includes("APP_SECRET")
          ? "The server is missing APP_SECRET, so it can't sign sessions. Set it and restart."
          : "Couldn't reach the server. Reload to try again.",
    };
  }
}

const signInSchema = z.object({
  publicKey: z.string().min(80).max(400),
  challenge: z.string().max(300),
  signature: z.string().min(40).max(200),
  timezone: z.string().max(64).optional(),
});

/** Prove possession of the device key → HTTP-only session cookie. A new key becomes a guest with 2 h. */
export async function signIn(input: z.infer<typeof signInSchema>): Promise<Result<{ created: boolean }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid sign-in" };
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    await rateLimit(`signin:${ip}`, { max: 20, windowS: 3600 });
    const res = await signInWithDevice(await getDb(), parsed.data);
    (await cookies()).set(SESSION_COOKIE, await issueSessionToken(res.memberId, res.deviceId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_S,
    });
    return { ok: true, data: { created: res.created } };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("[signIn]", e);
    return { ok: false, error: "Couldn't set up your guest identity." };
  }
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
}
