import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { formatDateTime } from "@/modules/booking/slots";
import { ACHIEVEMENTS, achievementById, ITEMS } from "@/modules/game/catalog";
import { decode, describe as describeGenome, rareGenes } from "@/modules/game/genome";
import { RANKS, rankIndex } from "@/modules/game/ranks";
import { describeRule } from "@/modules/game/rules";
import { progressFor } from "@/modules/game/service";
import { SOURCE_LABEL, type XpSource } from "@/modules/game/xp";
import { Card, List, Page, Section } from "@/ui/bits";
import { ItemIcon } from "@/ui/kitty/item-icon";
import { RenameKitty, Wardrobe } from "./wardrobe";

export const metadata = { title: "Your kitty" };

const achievementName = (id: string) => achievementById.get(id)?.name ?? id;

export default async function KittyPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const p = await progressFor(await getDb(), viewer.memberId);
  if (!p.kitty) redirect("/gate/kitty");
  const k = p.kitty;
  const g = decode(k.code, k.personality);
  const owned = new Set(p.items);
  const earned = new Map(p.achievements.map((a) => [a.id, a.at]));
  const items = ITEMS.map((it) => ({
    id: it.id,
    slot: it.slot,
    name: it.name,
    rarity: it.rarity,
    owned: owned.has(it.id),
    rule: describeRule(it.rule, { achievement: achievementName }),
  }));
  const rankOf = (slot: string) => RANKS.find((r) => r.slots.includes(slot as never))!;
  const slots = [...new Set(ITEMS.map((i) => i.slot))].map((slot) => ({
    slot,
    open: p.slots.includes(slot as never),
    opensAt: rankOf(slot).name,
  }));
  const rare = rareGenes(g);

  return (
    <Page
      title={k.name}
      sub={
        <>
          {describeGenome(g)}
          {rare.length ? <span className="text-ink">. {rare.join(", ")}</span> : null}
        </>
      }
      action={<RenameKitty name={k.name} />}
    >
      <Wardrobe
        kitty={{ code: k.code, stage: k.stage, name: k.name, equipped: k.equipped, roomTheme: k.roomTheme }}
        items={items}
        slots={slots}
        canTwilight={rankIndex(p.rank) >= rankIndex("puma")}
        progress={{
          level: p.level,
          xp: p.xp,
          levelStart: p.levelStart,
          levelNext: p.levelNext,
          fraction: p.levelFraction,
          rankName: p.rankName,
          nextRank: p.nextRank,
          treats: p.treats,
        }}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        <Section title={`Badges, ${earned.size} of ${ACHIEVEMENTS.length}`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const at = earned.get(a.id);
              return (
                <li
                  key={a.id}
                  data-perch=""
                  className={`flex items-center gap-3 border-2 p-3 ${at ? "border-paper-shade" : "border-dashed border-paper-shade"}`}
                >
                  <ItemIcon id={a.itemId} locked={!at} size={36} />
                  <div className="grid min-w-0 gap-0.5">
                    <span className={at ? "font-semibold" : "font-semibold text-ink-soft"}>{a.name}</span>
                    <span className="text-meta text-ink-soft">
                      {at
                        ? `Earned ${formatDateTime(new Date(at), viewer.member.timezone)}`
                        : describeRule(a.rule, { achievement: achievementName })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section title="Recent XP">
          {p.recent.length ? (
            <List>
              {p.recent.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-body">{SOURCE_LABEL[e.source as XpSource] ?? e.source}</span>
                  <span
                    className={`font-pixel text-body tabular-nums ${e.amount > 0 ? "text-ink" : "text-ink-soft"}`}
                  >
                    {e.amount > 0 ? `+${e.amount}` : e.amount}
                  </span>
                </div>
              ))}
            </List>
          ) : (
            <Card className="text-body text-ink-soft">
              XP comes only from settled sessions with a real person, plus a little for reviews and caring for
              your kitty.
            </Card>
          )}
          <p className="text-meta text-ink-soft">
            XP is not hours and not money. It can't be traded, gifted or bought.
          </p>
        </Section>
      </div>
    </Page>
  );
}
