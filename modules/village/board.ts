import { sql } from "drizzle-orm";
import type { Q } from "@/db/client";
import { rows } from "@/db/client";
import { levelName } from "@/modules/platform/format";
import { categoryColor, categoryIcon, GUILDS, guildForCategory } from "./guilds";
import { PRESENCE_LABEL, presenceOf } from "./service";

/** The Notice Board (§8.2): the same data as the village, as a list. */
export type BoardFilters = {
  tab: "offers" | "requests";
  q?: string;
  guild?: string;
  format?: string;
  when?: "now" | "any";
};

export async function boardRows(qy: Q, viewerId: string, f: BoardFilters, now = new Date()) {
  const guild = f.guild ? GUILDS.find((g) => g.id === f.guild) : null;
  const cats = guild?.categories ?? (f.guild === "market-row" ? ["career-business"] : null);
  const term = f.q?.trim().toLowerCase() ?? "";
  if (f.tab === "requests") {
    const list = rows<{
      id: string;
      skill: string;
      skillSlug: string;
      category: string;
      level: number;
      format: string;
      text: string;
      name: string;
      handle: string;
      memberId: string;
      createdAt: Date;
    }>(
      await qy.execute(sql`select r.id, s.name as skill, s.slug as "skillSlug", c.slug as category, r.level, r.format, r.text, m.display_name as name, m.handle, m.id as "memberId", r.created_at as "createdAt"
        from requests r join skills s on s.id = r.skill_id join categories c on c.id = s.category_id join members m on m.id = r.member_id
        where r.status = 'open' and m.deleted_at is null
        ${term ? sql`and (lower(s.name) like ${`%${term}%`} or lower(r.text) like ${`%${term}%`})` : sql``}
        ${f.format ? sql`and r.format = ${f.format}` : sql``}
        order by r.created_at desc limit 60`),
    );
    return list
      .filter((r) => !cats || cats.includes(r.category))
      .map((r) => ({
        kind: "request" as const,
        id: r.id,
        title: `${r.skill} · ${levelName(r.level)}`,
        who: r.name,
        handle: r.handle,
        status: "wants to learn",
        mine: r.memberId === viewerId,
        color: categoryColor(r.category),
        icon: categoryIcon(r.category),
        guild: guildForCategory(r.category)?.name ?? "Market Row",
        text: r.text,
      }));
  }
  const list = rows<{
    offerId: string;
    skill: string;
    category: string;
    level: number | null;
    formats: string[];
    name: string;
    handle: string;
    memberId: string;
    isSample: boolean;
    status: "free" | "busy" | "away";
    lastSeenAt: Date;
    lastInputAt: Date;
    sessionUntil: Date | null;
  }>(
    await qy.execute(sql`select o.id as "offerId", s.name as skill, c.slug as category, ms.level, o.formats, m.display_name as name, m.handle, m.id as "memberId", m.is_sample as "isSample",
        coalesce(v.status, 'busy') as status, coalesce(v.last_seen_at, m.created_at) as "lastSeenAt", coalesce(v.last_input_at, m.created_at) as "lastInputAt",
        (select b.started_at + b.length_min * interval '1 minute' from bookings b join booking_participants bp on bp.booking_id = b.id where bp.member_id = m.id and b.status = 'live' limit 1) as "sessionUntil"
      from offers o join skills s on s.id = o.skill_id join categories c on c.id = s.category_id join members m on m.id = o.member_id
      left join villagers v on v.member_id = m.id
      left join member_skills ms on ms.member_id = m.id and ms.skill_id = o.skill_id and ms.direction = 'teach'
      where o.active and m.deleted_at is null and m.id <> ${viewerId}
      ${term ? sql`and (lower(s.name) like ${`%${term}%`} or lower(s.keywords) like ${`%${term}%`} or lower(m.display_name) like ${`%${term}%`})` : sql``}
      ${f.format ? sql`and ${f.format} = any(o.formats)` : sql``}
      order by s.name limit 200`),
  );
  const out = list
    .filter((r) => !cats || cats.includes(r.category))
    .map((r) => {
      const presence = presenceOf(
        { status: r.status, lastSeenAt: new Date(r.lastSeenAt), lastInputAt: new Date(r.lastInputAt) },
        { isSample: r.isSample, inSessionUntil: r.sessionUntil ? new Date(r.sessionUntil) : null, now },
      );
      return {
        kind: "offer" as const,
        id: r.offerId,
        title: `${r.skill} · ${levelName(r.level ?? 3)}`,
        who: r.name,
        handle: r.handle,
        status: PRESENCE_LABEL[presence],
        presence,
        sample: r.isSample,
        mine: false,
        color: categoryColor(r.category),
        icon: categoryIcon(r.category),
        guild: guildForCategory(r.category)?.name ?? "Market Row",
        text: "",
      };
    })
    .filter((r) => f.when !== "now" || r.presence === "free");
  // Free now first: a lit lantern is the thing to act on.
  out.sort((a, b) => Number(b.presence === "free") - Number(a.presence === "free"));
  return out.slice(0, 60);
}
export type BoardRow = Awaited<ReturnType<typeof boardRows>>[number];
