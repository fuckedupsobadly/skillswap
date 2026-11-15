import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { accounts, ledgerEntries, members } from "@/db/schema";
import { toPublic } from "@/modules/ledger/service";
import { Hours, Mono, Page } from "@/ui/bits";
import { VerifyEntry } from "./verify";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(entryId)) notFound();
  const db = await getDb();
  const viewer = await getViewer();
  const [e] = await db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId));
  if (!e) notFound();
  const accts = await db
    .select()
    .from(accounts)
    .where(inArray(accounts.id, [e.debitAccount, e.creditAccount]));
  const owners = await db
    .select({ id: members.id, name: members.displayName, handle: members.handle })
    .from(members)
    .where(
      inArray(
        members.id,
        accts.filter((a) => a.ownerType === "member").map((a) => a.ownerId),
      ),
    );
  const label = (accountId: string) => {
    const a = accts.find((x) => x.id === accountId);
    if (!a) return accountId;
    if (a.ownerType !== "member") return a.label || a.ownerType;
    if (a.ownerId === viewer?.memberId) return "You";
    return owners.find((o) => o.id === a.ownerId)?.name ?? "Member";
  };
  const pub = toPublic(e);
  const rows: [string, React.ReactNode][] = [
    ["Entry", `#${e.seq}`],
    ["Kind", e.kind.replace("_", " ")],
    ["Amount", <Hours key="a" min={e.amountMin} />],
    ["From", label(e.debitAccount)],
    ["To", label(e.creditAccount)],
    ["Memo", e.memo || "—"],
    [
      "Session",
      e.bookingId ? (
        <Link key="b" className="underline underline-offset-4" href={`/sessions/${e.bookingId}`}>
          Open
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Signed by", <Mono key="s">{e.signerKey}</Mono>],
    ["Time", pub.createdAt],
  ];
  return (
    <Page
      title="Receipt"
      sub="Every movement of hours is one entry that can never be changed."
      scene={{ place: "bank" }}
      size="narrow"
    >
      <dl className="grid">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex min-h-11 items-center justify-between gap-4 border-t-2 border-paper-shade py-2 first:border-t-0"
          >
            <dt className="field-label">{k}</dt>
            <dd className="text-right text-body first-letter:uppercase">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="divider grid gap-2 pt-5">
        <span className="text-meta text-ink-soft">Previous hash</span>
        <Mono>{e.prevHash}</Mono>
        <span className="text-meta text-ink-soft">
          This entry's hash = SHA-256(previous hash + canonical JSON of the entry)
        </span>
        <Mono>{e.hash}</Mono>
      </div>
      <VerifyEntry entry={pub} />
    </Page>
  );
}
