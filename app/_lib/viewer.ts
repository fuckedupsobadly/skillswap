import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db/client";
import { devices, members } from "@/db/schema";
import { readSessionToken, SESSION_COOKIE } from "@/modules/identity/session";
import { DomainError } from "@/modules/platform/errors";

export type Viewer = {
  memberId: string;
  deviceId: string;
  signerKey: string;
  member: typeof members.$inferSelect;
};

/** The current member, from the HTTP-only session cookie. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const claims = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const db = await getDb();
  const [row] = await db
    .select({ member: members, fingerprint: devices.fingerprint })
    .from(devices)
    .innerJoin(members, eq(members.id, devices.memberId))
    .where(eq(devices.id, claims.deviceId));
  if (!row || row.member.id !== claims.memberId || row.member.deletedAt) return null;
  return {
    memberId: row.member.id,
    deviceId: claims.deviceId,
    signerKey: row.fingerprint,
    member: row.member,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new DomainError("forbidden", "Your guest identity is still being set up. Reload the page.");
  return v;
}
