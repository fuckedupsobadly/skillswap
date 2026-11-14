import { getDb } from "@/db/client";
import { ledgerHead } from "@/modules/ledger/service";
import { Mono, Page, Section } from "@/ui/bits";
import { Verifier } from "./verifier";

export const metadata = { title: "Clock Tower" };

/** The public ledger audit (§3.1, §8.6). Anyone can climb; no account needed. */
export default async function Tower() {
  const head = await ledgerHead(await getDb());
  return (
    <Page
      title="Clock Tower"
      sub="Climb up and check the gears. Your browser re-reads every hour ever moved and recomputes the chain."
    >
      <Verifier serverHead={head} />
      <Section title="How the gears work">
        <div className="grid gap-3 text-ink-soft">
          <p>
            Each entry stores the hash of the one before it. Changing any past entry, even by one minute,
            changes its hash and breaks every link after it. The database also refuses edits and deletes on
            the ledger.
          </p>
          <p>
            The same data is public at <Mono>/api/v1/ledger?after=0</Mono> and{" "}
            <Mono>/api/v1/ledger/head</Mono>, so you can check it with your own code.
          </p>
        </div>
      </Section>
    </Page>
  );
}
