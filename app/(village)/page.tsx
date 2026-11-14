import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { villagers } from "@/db/schema";
import { VillageWorld } from "@/ui/village/world";
import { getViewer } from "../_lib/viewer";

export const metadata = { title: { absolute: "SkillSwap Village" } };

/** The village is the product. Plain mode (a choice, per member and per device) sends you to the Notice Board. */
export default async function Village({ searchParams }: { searchParams: Promise<{ village?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const jar = await cookies();
  if (sp.village) {
    // "Enter the village" from Plain mode turns Plain mode off.
    if (viewer)
      await (await getDb())
        .update(villagers)
        .set({ plainMode: false })
        .where(eq(villagers.memberId, viewer.memberId));
  } else {
    let plain = jar.get("ss_plain")?.value === "1";
    if (viewer && !plain) {
      const [v] = await (await getDb())
        .select({ p: villagers.plainMode })
        .from(villagers)
        .where(eq(villagers.memberId, viewer.memberId));
      plain = Boolean(v?.p);
    }
    if (plain) redirect("/board");
  }
  return (
    <Suspense>
      <VillageWorld />
    </Suspense>
  );
}
