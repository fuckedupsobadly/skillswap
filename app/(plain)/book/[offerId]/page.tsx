import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { categories, members, offers, requests, skills } from "@/db/schema";
import { bookableSlots } from "@/modules/booking/service";
import { walletSummary } from "@/modules/ledger/service";
import { levelName } from "@/modules/platform/format";
import { TRUST_NAMES } from "@/modules/trust/reputation";
import { ensureVillager, memberCard } from "@/modules/village/service";
import { Page } from "@/ui/bits";
import { Portrait } from "@/ui/portrait";
import { BookingForm } from "./form";

export const metadata = { title: "Book" };

/** The booking scroll (§8.4). `?at` preselects a time (hut sign), `?len` a length, `?now` the next minutes. */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>;
  searchParams: Promise<{ request?: string; at?: string; len?: string; now?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const [{ offerId }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(offerId)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ offer: offers, teacher: members, skill: skills, category: categories })
    .from(offers)
    .innerJoin(members, eq(members.id, offers.memberId))
    .innerJoin(skills, eq(skills.id, offers.skillId))
    .innerJoin(categories, eq(categories.id, skills.categoryId))
    .where(eq(offers.id, offerId));
  if (!row?.offer.active) notFound();
  if (row.teacher.id === viewer.memberId) redirect("/hut");
  const [req] = sp.request ? await db.select().from(requests).where(eq(requests.id, sp.request)) : [];
  const lengths = [...row.offer.lengths].sort((a, b) => a - b);
  const [wallet, v, card] = await Promise.all([
    walletSummary(db, viewer.memberId),
    ensureVillager(db, row.teacher.id),
    memberCard(db, viewer.memberId, row.teacher.handle),
  ]);
  const slotsByLength = Object.fromEntries(
    await Promise.all(
      lengths.map(
        async (len) =>
          [
            len,
            (await bookableSlots(db, row.teacher.id, viewer.memberId, len))
              .slice(0, 48)
              .map((d) => d.toISOString()),
          ] as const,
      ),
    ),
  );
  const wantLen = Number(sp.len);
  const defaultLength = lengths.includes(wantLen)
    ? wantLen
    : req && lengths.includes(req.lengthMin)
      ? req.lengthMin
      : lengths.includes(30)
        ? 30
        : lengths[0];
  const first = row.teacher.displayName.split(" ")[0];
  const at = sp.at && !Number.isNaN(Date.parse(sp.at)) ? new Date(sp.at).toISOString() : null;
  const notes = [
    req ? `You asked as ${levelName(req.level).toLowerCase()}.` : null,
    row.category.rules.notes ? `${row.category.rules.notes}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Page
      title={`Book ${first} · ${row.skill.name}`}
      size="narrow"
      scene={{
        hut: {
          roof: card?.roof ?? "#b7a28c",
          look: v.hut,
          presence: card?.presence ?? "busy",
          villager: v.look,
          kitty: card?.kitty?.code ?? null,
        },
      }}
    >
      {/* Portrait and nameplate, the same as the dialogue box (§6.3). */}
      <div className="flex items-center gap-3">
        <div className="window shrink-0">
          <Portrait look={v.look} size={48} />
        </div>
        <div className="grid gap-0.5">
          <span className="font-name text-name">{row.teacher.displayName}</span>
          <span className="text-meta text-ink-soft">
            {card?.presenceLabel ?? "Busy"} · Trust {row.teacher.trustLevel} (
            {TRUST_NAMES[row.teacher.trustLevel]}) · video in a Lantern Room
            {row.teacher.isSample ? " · Sample" : ""}
          </span>
        </div>
      </div>
      <BookingForm
        offerId={row.offer.id}
        requestId={req && req.memberId === viewer.memberId ? req.id : null}
        lengths={lengths}
        defaultLength={defaultLength}
        slotsByLength={slotsByLength}
        initialAt={at}
        wantNow={sp.now === "1"}
        myTz={viewer.member.timezone}
        theirTz={row.teacher.timezone}
        theirName={first}
        balanceMin={wallet.balanceMin}
        note={notes || null}
      />
    </Page>
  );
}
