import { getDb } from "@/db/client";
import { progressFor } from "@/modules/game/service";
import { getViewer } from "../../../../_lib/viewer";

/** Level, rank, next unlocks, the kitty and its needs, and the latest XP events. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "No guest identity yet." }, { status: 401 });
  return Response.json(await progressFor(await getDb(), viewer.memberId), {
    headers: { "Cache-Control": "no-store" },
  });
}
