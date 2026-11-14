import { z } from "zod";
import { DomainError } from "@/modules/platform/errors";
import { rateLimit } from "@/modules/platform/rate-limit";
import { hub } from "@/modules/village/hub";
import { getViewer } from "../../../../_lib/viewer";

/** Short nearby chat: max 140 characters, only people within range hear it, nothing is stored. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });
  const p = z
    .object({ text: z.string().trim().min(1).max(140) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "1 to 140 characters." }, { status: 400 });
  try {
    await rateLimit(`say:${viewer.memberId}`, { max: 12, windowS: 60 });
  } catch (e) {
    if (e instanceof DomainError) return Response.json({ error: e.message }, { status: 429 });
    throw e;
  }
  hub.say(viewer.memberId, p.data.text);
  return new Response(null, { status: 204 });
}
