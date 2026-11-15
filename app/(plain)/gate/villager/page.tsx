import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { ensureVillager } from "@/modules/village/service";
import { Page } from "@/ui/bits";
import { Creator } from "./creator";

export const metadata = { title: "Make your villager" };

export default async function VillagerPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const v = await ensureVillager(await getDb(), viewer.memberId);
  const onboarding = v.onboardingStep <= 3;
  return (
    <Page title="Make your villager" scene={{ place: "gate" }} size="narrow">
      <Creator initial={v.look} name={viewer.member.displayName} onboarding={onboarding} />
    </Page>
  );
}
