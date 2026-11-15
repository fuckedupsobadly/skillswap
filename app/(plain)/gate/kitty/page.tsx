import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { candidates, kittyFor } from "@/modules/game/service";
import { Page } from "@/ui/bits";
import { KittyStep } from "./step";

export const metadata = { title: "Pick your kitten" };

/** Onboarding step 3 (§11): pick one of three kittens and name it (Gamification doc). */
export default async function KittyGate() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const kitty = await kittyFor(db, viewer.memberId);
  const list = kitty ? [] : (await candidates(db, viewer.memberId)).map((c) => c.code);
  return (
    <Page title="Pick your kitten" scene={{ place: "gate" }} size="narrow">
      <KittyStep candidates={list} hasKitty={Boolean(kitty)} />
    </Page>
  );
}
