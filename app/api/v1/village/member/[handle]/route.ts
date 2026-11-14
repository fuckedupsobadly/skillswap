import { getDb } from "@/db/client";
import { memberCard } from "@/modules/village/service";
import { getViewer } from "../../../../../_lib/viewer";

/** Dialogue box / hut sign data for one member. */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "No guest identity yet." }, { status: 401 });
  const card = await memberCard(await getDb(), viewer.memberId, (await params).handle);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(card, { headers: { "Cache-Control": "no-store" } });
}
