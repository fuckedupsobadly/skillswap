import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { ensureVillager } from "@/modules/village/service";
import { Page } from "@/ui/bits";
import { GateWelcome } from "./welcome";

export const metadata = { title: "The Gate" };

/** The Gate (§3.1): arrival, character creation, the Plain mode switch. Onboarding step 1 (§11). */
export default async function Gate() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <Page title="The Gate" sub="Opening the gate for you…" scene={{ place: "gate" }} size="narrow">
        {null}
      </Page>
    );
  const v = await ensureVillager(await getDb(), viewer.memberId);
  if (v.onboardingStep === 2) redirect("/gate/villager");
  return (
    <Page title="The Gate" scene={{ place: "gate" }} size="narrow">
      <GateWelcome firstVisit={v.onboardingStep <= 1} />
    </Page>
  );
}
