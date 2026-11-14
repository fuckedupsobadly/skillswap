import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { members } from "@/db/schema";
import { publicProfileGame } from "@/modules/game/service";

/** Public render data for another member's kitty: genome, stage and equipped items (rank if shown). */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const db = await getDb();
  const [m] = await db.select({ id: members.id }).from(members).where(eq(members.handle, handle));
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  const g = await publicProfileGame(db, m.id);
  if (!g.kitty) return Response.json({ error: "No kitty yet" }, { status: 404 });
  return Response.json(
    {
      name: g.kitty.name,
      genome: g.kitty.code,
      stage: g.kitty.stage,
      equipped: g.kitty.equipped,
      roomTheme: g.kitty.roomTheme,
      rank: g.showRank ? g.rankName : null,
      level: g.showRank ? g.level : null,
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
