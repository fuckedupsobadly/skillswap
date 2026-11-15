import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { formatDateTime } from "@/modules/booking/slots";
import { walletSummary } from "@/modules/ledger/service";
import { formatHours } from "@/modules/platform/format";
import { POOL_EVERY_DAYS, POOL_GRANT, POOL_MAX_BALANCE, poolStatus } from "@/modules/village/service";
import { Columns, Page, Section, Stack } from "@/ui/bits";
import { GiftForm } from "../bank/gift";
import { AskPool } from "./parts";

export const metadata = { title: "Community Pond" };

/** The Community Pond (§3.1): the shared hours pool. Gifts fill it; members under 1 h can ask it for help. */
export default async function Pond() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [s, w] = await Promise.all([poolStatus(db, viewer.memberId), walletSummary(db, viewer.memberId)]);
  const reason =
    s.balanceMin >= POOL_MAX_BALANCE
      ? `The pool is for members with under ${formatHours(POOL_MAX_BALANCE)}. You have ${formatHours(s.balanceMin)}.`
      : s.nextAt && new Date(s.nextAt) > new Date()
        ? `You can ask once every ${POOL_EVERY_DAYS} days. Next time: ${formatDateTime(new Date(s.nextAt), viewer.member.timezone)}.`
        : s.poolMin < POOL_GRANT
          ? "The pond is low right now. Gifts refill it."
          : "";
  return (
    <Page
      title="Community Pond"
      sub="Hours that members gave so newcomers and people in a rough patch can still learn."
      scene={{ place: "pond" }}
    >
      <Columns>
        <Stack>
          <dl className="window grid grid-cols-2 divide-x-2 divide-paper-shade">
            <div className="grid gap-1 px-4 py-3">
              <dt className="field-label text-ink-soft">In the pond</dt>
              <dd className="tnum text-name font-semibold">{formatHours(s.poolMin)}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3">
              <dt className="field-label text-ink-soft">Given by</dt>
              <dd className="tnum text-name font-semibold">
                {s.donors} {s.donors === 1 ? "member" : "members"}
              </dd>
            </div>
          </dl>

          <Section title="Ask for an hour" icon="hourglass">
            <p className="text-ink-soft">
              If you have under {formatHours(POOL_MAX_BALANCE)}, the pond gives you {formatHours(POOL_GRANT)},
              once every {POOL_EVERY_DAYS} days.
            </p>
            <AskPool eligible={s.eligible} reason={reason} />
          </Section>
        </Stack>
        <Section title="Give to the pond" icon="sign">
          <GiftForm max={Math.max(0, w.balanceMin)} community />
        </Section>
      </Columns>
    </Page>
  );
}
