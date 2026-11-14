import { type NextRequest, NextResponse } from "next/server";
import {
  issueSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_ROTATE_S,
  SESSION_TTL_S,
} from "@/modules/identity/session";

/** Session rotation: a valid cookie older than a day is reissued, so sessions stay short-lived but seamless. */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();
  const claims = await readSessionToken(token);
  if (!claims) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (Date.now() / 1000 - claims.issuedAt < SESSION_ROTATE_S) return NextResponse.next();
  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE, await issueSessionToken(claims.memberId, claims.deviceId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return res;
}

export const config = { matcher: ["/((?!_next/|api/|favicon.ico).*)"] };
