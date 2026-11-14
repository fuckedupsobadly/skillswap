import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { villagers } from "@/db/schema";
import { proposalsFor } from "@/modules/matching/service";
import { lookFromSeed } from "@/modules/village/art/people";
import { getViewer } from "../../../../_lib/viewer";

/** Tavern tables: each proposed swap cycle is a table with a chair for everyone in the loop (§8.3). */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "No guest identity yet." }, { status: 401 });
  const db = await getDb();
  const cycles = (await proposalsFor(db, viewer.memberId)).filter((c) => c.status === "proposed").slice(0, 5);
  const ids = [...new Set(cycles.flatMap((c) => c.members))];
  const looks = ids.length
    ? await db
        .select({ id: villagers.memberId, look: villagers.look })
        .from(villagers)
        .where(inArray(villagers.memberId, ids))
    : [];
  const lookOf = new Map(looks.map((l) => [l.id, l.look]));
  return Response.json({
    tables: cycles.map((c) => ({
      id: c.id,
      size: c.members.length,
      seats: c.members.map((m) => ({
        memberId: m,
        you: m === viewer.memberId,
        name: c.people.find((p) => p?.id === m)?.displayName ?? "Member",
        accepted: c.acceptedBy.includes(m),
        look: lookOf.get(m) ?? lookFromSeed(m),
      })),
    })),
  });
}
