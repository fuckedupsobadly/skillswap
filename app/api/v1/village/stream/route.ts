import { getDb } from "@/db/client";
import { kittyFor } from "@/modules/game/service";
import { type HubEvent, hub } from "@/modules/village/hub";
import { MAP_H, MAP_W, SPAWN } from "@/modules/village/map";
import { ensureVillager, touch } from "@/modules/village/service";
import { getViewer } from "../../../../_lib/viewer";

/** Server-Sent Events: nearby players joining, moving, waving and talking. */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("unauthorized", { status: 401 });
  const db = await getDb();
  const v = await ensureVillager(db, viewer.memberId);
  const kitty = await kittyFor(db, viewer.memberId);
  const url = new URL(req.url);
  const x = Math.max(0, Math.min(MAP_W - 1, Number(url.searchParams.get("x") ?? SPAWN.x) || SPAWN.x));
  const y = Math.max(0, Math.min(MAP_H - 1, Number(url.searchParams.get("y") ?? SPAWN.y) || SPAWN.y));
  const enc = new TextEncoder();
  let sub: { memberId: string; send: (e: HubEvent) => void } | null = null;
  let beat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: HubEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* closed */
        }
      };
      sub = { memberId: viewer.memberId, send };
      hub.join(
        {
          memberId: viewer.memberId,
          handle: viewer.member.handle,
          name: viewer.member.displayName,
          look: v.look,
          kitty: kitty?.code ?? null,
          x,
          y,
          dir: "up",
          anim: "idle",
          hidden: v.hideMe,
        },
        sub,
      );
      beat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": beat\n\n"));
        } catch {
          clearInterval(beat);
        }
        void touch(db, viewer.memberId, false);
      }, 25_000);
      req.signal.addEventListener("abort", () => {
        clearInterval(beat);
        if (sub) hub.leave(viewer.memberId, sub);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      clearInterval(beat);
      if (sub) hub.leave(viewer.memberId, sub);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
