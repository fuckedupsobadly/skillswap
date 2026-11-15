import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { aiEnabled } from "@/modules/ai/concierge";
import { availabilityOf } from "@/modules/market/service";
import { describeAvailability } from "@/modules/village/when";
import { Page } from "@/ui/bits";
import { WishForm } from "./wish";

export const metadata = { title: "Wishing Well" };

/** §8.1 Wishing Well — post a learning request. */
export default async function Well({
  searchParams,
}: {
  searchParams: Promise<{ first?: string; q?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const sp = await searchParams;
  const when = describeAvailability(await availabilityOf(await getDb(), viewer.memberId));
  return (
    <Page
      title="Make a wish"
      sub="Tell the Well what you want to learn. A match lands in your mailbox."
      scene={{ place: "well" }}
      size="narrow"
    >
      <WishForm when={when} ai={aiEnabled()} first={sp.first === "1"} initial={sp.q ?? ""} />
    </Page>
  );
}
