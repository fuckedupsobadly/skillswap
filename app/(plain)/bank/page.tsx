import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { MEMBER_FLOOR_MIN } from "@/modules/ledger/core";
import { walletSummary } from "@/modules/ledger/service";
import { formatHours } from "@/modules/platform/format";
import { bankHistory } from "@/modules/village/bank";
import { Empty, Page, Section } from "@/ui/bits";
import { PixelIcon } from "@/ui/pixel/icons";
import { GiftForm } from "./gift";

export const metadata = { title: "Hourglass Bank" };

/**
 * The teller window (§8.6): Balance, Held, History — one list, newest first, each row a sentence.
 * Gifting is the only thing you can do here; hours are never bought or sold.
 */
export default async function Bank() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [w, history] = await Promise.all([
    walletSummary(db, viewer.memberId),
    bankHistory(db, viewer.memberId, viewer.member.timezone),
  ]);
  return (
    <Page title="Hourglass Bank" sub="The teller keeps your hours. One hour is always one hour.">
      <dl className="grid grid-cols-2 gap-px bg-paper-shade" aria-label="Your hours">
        <div className="grid gap-1 bg-paper py-1 pr-4">
          <dt className="flex items-center gap-2 font-pixel text-label">
            <PixelIcon name="hourglass" size={16} />
            Balance
          </dt>
          <dd className="tnum text-body font-medium">{formatHours(w.balanceMin)}</dd>
        </div>
        <div className="grid gap-1 bg-paper py-1 pl-4">
          <dt className="font-pixel text-label">Held</dt>
          <dd className="tnum text-body font-medium">
            {formatHours(w.heldMin)}
            <span className="ml-2 text-meta font-normal text-ink-soft">
              {w.heldMin ? "paid after you both confirm" : "nothing waiting"}
            </span>
          </dd>
        </div>
      </dl>
      <p className="-mt-3 text-meta text-ink-soft">
        You can go down to {formatHours(MEMBER_FLOOR_MIN)} to learn before you teach.
      </p>

      <Section
        title="History"
        aside={
          <Link href="/tower" className="btn btn-tertiary -my-2 -mr-2">
            Check the gears
          </Link>
        }
      >
        {history.length === 0 ? (
          <Empty>Nothing has moved yet. Your starter hours arrive when you make your villager.</Empty>
        ) : (
          <ol className="grid">
            {history.map((r) => (
              <li key={r.id} className="border-t-2 border-paper-shade first:border-t-0">
                <Link href={`/bank/${r.id}`} className="group flex min-h-11 items-baseline gap-2 py-2.5">
                  <span className={`tnum w-16 shrink-0 font-medium ${r.amountMin > 0 ? "text-ok" : ""}`}>
                    {formatHours(r.amountMin, { sign: true })}
                  </span>
                  <span className="min-w-0 flex-1 group-hover:underline group-hover:underline-offset-4">
                    {r.line}
                    {r.pending ? <span className="text-meta text-ink-soft"> · waiting</span> : null}
                  </span>
                  <span className="tnum shrink-0 text-meta text-ink-soft">{r.day}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Gift hours">
        <GiftForm max={Math.max(0, w.balanceMin)} />
      </Section>
    </Page>
  );
}
