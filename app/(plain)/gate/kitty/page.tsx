import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { candidates, kittyFor } from "@/modules/game/service";
import { ensureVillager } from "@/modules/village/service";
import { Page } from "@/ui/bits";
import { KittyStep } from "./step";

export const metadata = { title: "Pick your kitten" };

/** Onboarding step 3 (§11): pick one of three kittens and name it (Gamification doc). */
export default async function KittyGate() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [v, kitty] = await Promise.all([ensureVillager(db, viewer.memberId), kittyFor(db, viewer.memberId)]);
  const list = kitty ? [] : (await candidates(db, viewer.memberId)).map((c) => c.code);
  return (
    <Page
      title="Pick your kitten"
      action={
        v.onboardingStep <= 3 ? (
          <span className="font-pixel text-label text-ink-soft">Step 3/7</span>
        ) : undefined
      }
    >
      <KittyStep candidates={list} hasKitty={Boolean(kitty)} />
    </Page>
  );
}
