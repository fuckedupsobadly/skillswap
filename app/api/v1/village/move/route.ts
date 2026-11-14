import { z } from "zod";
import { getDb } from "@/db/client";
import { hub } from "@/modules/village/hub";
import { MAP_H, MAP_W } from "@/modules/village/map";
import { touch } from "@/modules/village/service";
import { getViewer } from "../../../../_lib/viewer";

const schema = z.object({
  x: z
    .number()
    .int()
    .min(0)
    .max(MAP_W - 1),
  y: z
    .number()
    .int()
    .min(0)
    .max(MAP_H - 1),
  dir: z.enum(["down", "up", "left", "right"]),
  anim: z.enum(["idle", "walk", "wave", "sit"]),
});
const lastTouch = new Map<string, number>();

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return new Response(null, { status: 400 });
  hub.move(viewer.memberId, p.data.x, p.data.y, p.data.dir, p.data.anim);
  // Walking is input: it keeps you out of AFK. Written at most twice a minute.
  if (Date.now() - (lastTouch.get(viewer.memberId) ?? 0) > 30_000) {
    lastTouch.set(viewer.memberId, Date.now());
    await touch(await getDb(), viewer.memberId, true);
  }
  return new Response(null, { status: 204 });
}
