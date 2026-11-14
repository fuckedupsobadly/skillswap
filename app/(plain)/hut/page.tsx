import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { allSkills } from "@/modules/catalog/service";
import { progressFor } from "@/modules/game/service";
import { availabilityOf, memberSkillsOf } from "@/modules/market/service";
import { ensureVillager, memberCard, unreadCount } from "@/modules/village/service";
import { Page, Section } from "@/ui/bits";
import { KittyPreview } from "@/ui/kitty/preview";
import { PixelIcon } from "@/ui/pixel/icons";
import { Portrait } from "@/ui/portrait";
import { AvailabilityForm, ProfileForm, SkillsForm } from "../hall/forms";
import { HutLookForm, LanternForm } from "./parts";

export const metadata = { title: "Your hut" };

/**
 * Your hut (§3.1): profile editing, the wardrobe and the kitty's home. The lantern is the first thing here
 * because it is the one setting that changes what neighbours see right now.
 */
export default async function Hut() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const v = await ensureVillager(db, viewer.memberId);
  const [card, options, mine, avail, game, unread] = await Promise.all([
    memberCard(db, viewer.memberId, viewer.member.handle),
    allSkills(db),
    memberSkillsOf(db, viewer.memberId),
    availabilityOf(db, viewer.memberId),
    progressFor(db, viewer.memberId),
    unreadCount(db, viewer.memberId),
  ]);
  const m = viewer.member;
  const first = card?.teaches[0];
  return (
    <Page title="Your hut" sub="Light the lantern when you're free to teach.">
      <Section title="Lantern">
        <LanternForm status={v.status} statusLine={v.statusLine} />
      </Section>

      <Section title="Your villager">
        <div className="flex items-center gap-4">
          <div className="bg-paper-shade">
            <Portrait look={v.look} size={48} />
          </div>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-name text-name">{m.displayName}</span>
            <span className="text-meta text-ink-soft">
              {card?.presenceLabel ?? "Busy"}
              {card?.teaches.length
                ? ` · teaches ${card.teaches.map((t) => t.name).join(", ")}`
                : " · nothing to teach yet"}
            </span>
          </div>
          <Link href="/gate/villager" className="btn btn-secondary">
            Change look
          </Link>
        </div>
      </Section>

      <Section title="The hut">
        <HutLookForm
          initial={v.hut}
          roof={first?.color ?? "#b7a28c"}
          guild={first?.guild ?? null}
          status={v.status}
          kitty={game.kitty?.code ?? null}
        />
      </Section>

      <Section
        title="Mailbox"
        aside={
          <Link href="/inbox" className="btn btn-tertiary -my-2 -mr-2">
            Open
          </Link>
        }
      >
        <p className="flex items-center gap-2 text-ink-soft">
          <PixelIcon name="mailbox" size={16} />
          {unread
            ? `${unread} new ${unread === 1 ? "note" : "notes"} waiting.`
            : "No new notes. Neighbours leave them here when you're out."}
        </p>
      </Section>

      <div id="kitty" className="scroll-mt-20">
        <Section
          title="Kitty"
          aside={
            game.kitty ? (
              <Link href="/kitty" className="btn btn-tertiary -my-2 -mr-2">
                Wardrobe
              </Link>
            ) : null
          }
        >
          {game.kitty ? (
            <div className="flex items-center gap-4">
              <div className="bg-paper-shade">
                <KittyPreview
                  code={game.kitty.code}
                  stage={game.kitty.stage}
                  equipped={game.kitty.equipped}
                  scale={1}
                  label={`${game.kitty.name}, your kitty`}
                />
              </div>
              <div className="grid gap-0.5">
                <span className="font-name text-name">{game.kitty.name}</span>
                <span className="text-meta text-ink-soft">
                  Level {game.level} · {game.rankName}. Sleeps on your step while you're away.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-soft">The step is empty. A kitten is waiting at the Gate.</p>
              <Link href="/gate/kitty" className="btn btn-secondary">
                Meet the kittens
              </Link>
            </div>
          )}
        </Section>
      </div>

      <Section title="About you">
        <ProfileForm
          initial={{ displayName: m.displayName, bio: m.bio, timezone: m.timezone, languages: m.languages }}
        />
      </Section>

      <div id="skills" className="scroll-mt-20">
        <Section title="Teach and learn">
          <SkillsForm
            options={options.map((o) => ({ id: o.id, name: o.name, category: o.category }))}
            teach={mine
              .filter((s) => s.direction === "teach")
              .map((s) => ({ skillId: s.skillId, level: s.level }))}
            learn={mine
              .filter((s) => s.direction === "learn")
              .map((s) => ({ skillId: s.skillId, level: s.level }))}
          />
        </Section>
      </div>

      <div id="availability" className="scroll-mt-20">
        <Section title="When you're around">
          <AvailabilityForm
            rules={avail.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }))}
            timezone={m.timezone}
          />
        </Section>
      </div>
    </Page>
  );
}
