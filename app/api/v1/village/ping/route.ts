import { getDb } from "@/db/client";
import { touch } from "@/modules/village/service";
import { getViewer } from "../../../../_lib/viewer";

/** Heartbeat from any page: online, and (if the member did something) not AFK. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });
  const input = new URL(req.url).searchParams.get("input") === "1";
  await touch(await getDb(), viewer.memberId, input);
  return new Response(null, { status: 204 });
}
