import { z } from "zod";
import { getDb } from "@/db/client";
import { recordWalks } from "@/modules/village/service";
import { getViewer } from "../../../../_lib/viewer";

/** Anonymous per-tile walk counts (no member id is stored), for worn paths. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });
  const p = z
    .array(z.tuple([z.number().int(), z.number().int(), z.number().int()]))
    .max(400)
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return new Response(null, { status: 400 });
  await recordWalks(await getDb(), p.data);
  return new Response(null, { status: 204 });
}
