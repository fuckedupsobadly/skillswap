import { eq, sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { wornTiles } from "@/db/schema";
import { nextSessionFor } from "@/modules/booking/service";
import { kittyFor } from "@/modules/game/service";
import { walletSummary } from "@/modules/ledger/service";
import { ensureVillager, hutsFor, touch, traces, unreadCount } from "@/modules/village/service";
import { getViewer } from "../../../../_lib/viewer";

/** One read for the whole village: you, the huts chosen for you, activity traces, worn paths. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "No guest identity yet." }, { status: 401 });
  const db = await getDb();
  await touch(db, viewer.memberId, false);
  const v = await ensureVillager(db, viewer.memberId);
  const [huts, tr, worn, wallet, next, unread, kitty, pending] = await Promise.all([
    hutsFor(db, viewer.memberId),
    traces(db),
    db.select().from(wornTiles),
    walletSummary(db, viewer.memberId),
    nextSessionFor(db, viewer.memberId),
    unreadCount(db, viewer.memberId),
    kittyFor(db, viewer.memberId),
    db.execute(
      sql`select count(*)::int as n from swap_cycles where ${viewer.memberId} = any(members) and status = 'proposed' and not (${viewer.memberId} = any(accepted_by)) and expires_at > now()`,
    ),
  ]);
  const withName = next
    ? rows<{ name: string }>(
        await db.execute(
          sql`select m.display_name as name from booking_participants bp join members m on m.id = bp.member_id where bp.booking_id = ${next.id} and bp.member_id <> ${viewer.memberId} limit 1`,
        ),
      )[0]?.name
    : null;
  return Response.json(
    {
      viewer: {
        memberId: viewer.memberId,
        handle: viewer.member.handle,
        name: viewer.member.displayName,
        timezone: viewer.member.timezone,
        look: v.look,
        status: v.status,
        statusLine: v.statusLine,
        hideMe: v.hideMe,
        plainMode: v.plainMode,
        onboardingStep: v.onboardingStep,
        balanceMin: wallet.balanceMin,
        heldMin: wallet.heldMin,
        unread,
        swapsWaiting: rows<{ n: number }>(pending)[0].n,
        kitty: kitty ? { name: kitty.name, code: kitty.code } : null,
        nextSession: next
          ? {
              id: next.id,
              skill: next.skill,
              with: withName,
              startsAt: next.startsAt.toISOString(),
              status: next.status,
            }
          : null,
      },
      huts,
      traces: tr,
      worn: worn.map((w) => [w.x, w.y, w.level]),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
void eq;
