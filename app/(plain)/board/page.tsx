import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { allSkills } from "@/modules/catalog/service";
import { boardRows } from "@/modules/village/board";
import { GUILDS, MARKET } from "@/modules/village/guilds";
import { ensureVillager } from "@/modules/village/service";
import { Empty, Page } from "@/ui/bits";
import { PixelIcon } from "@/ui/pixel/icons";
import { BoardList } from "./list";
import { TeachPicker } from "./parts";

export const metadata = { title: "Notice Board" };

/** §8.2 — the accessible heart: the same data as the village, as a list; Plain mode's home. */
export default async function Board({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    guild?: string;
    format?: string;
    when?: string;
    teach?: string;
  }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const sp = await searchParams;
  const db = await getDb();
  const tab = sp.tab === "requests" ? "requests" : "offers";
  const filters = {
    tab,
    q: sp.q,
    guild: sp.guild,
    format: sp.format,
    when: sp.when === "now" ? "now" : "any",
  } as const;
  const [list, villager, skills] = await Promise.all([
    boardRows(db, viewer.memberId, filters),
    ensureVillager(db, viewer.memberId),
    sp.teach ? allSkills(db) : Promise.resolve([]),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    return `/board?${p.toString()}`;
  };
  return (
    <Page
      title="Notice Board"
      action={
        <nav aria-label="Board" className="flex">
          <Link
            href={qs({ tab: undefined })}
            aria-current={tab === "offers" ? "page" : undefined}
            className={`btn ${tab === "offers" ? "btn-secondary" : "btn-tertiary"}`}
          >
            Offers
          </Link>
          <Link
            href={qs({ tab: "requests" })}
            aria-current={tab === "requests" ? "page" : undefined}
            className={`btn ${tab === "requests" ? "btn-secondary" : "btn-tertiary"}`}
          >
            Requests
          </Link>
        </nav>
      }
    >
      {sp.teach && villager.onboardingStep === 6 ? (
        <TeachPicker skills={skills.map((s) => ({ id: s.id, name: s.name, category: s.categorySlug }))} />
      ) : null}
      <search>
        <form className="grid gap-2">
          <input type="hidden" name="tab" value={tab === "requests" ? "requests" : ""} />
          <label htmlFor="board-q" className="sr-only">
            Search
          </label>
          <div className="flex gap-2">
            <input
              id="board-q"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search, e.g. guitar"
              className="field"
            />
            <button type="submit" className="btn btn-secondary" aria-label="Search">
              <PixelIcon name="search" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select name="guild" defaultValue={sp.guild ?? ""} aria-label="Guild" className="field">
              <option value="">Guild</option>
              {GUILDS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value={MARKET.id}>{MARKET.name}</option>
            </select>
            <select name="format" defaultValue={sp.format ?? ""} aria-label="Format" className="field">
              <option value="">Format</option>
              <option value="live">Video</option>
              <option value="in_person">In person</option>
              <option value="async">Send my work</option>
            </select>
            <select name="when" defaultValue={sp.when ?? ""} aria-label="When" className="field">
              <option value="">When</option>
              <option value="now">Free now</option>
              <option value="any">Any time</option>
            </select>
          </div>
        </form>
      </search>
      {list.length === 0 ? (
        <Empty
          action={
            <Link href="/well" className="btn btn-secondary">
              Make a wish
            </Link>
          }
        >
          {tab === "offers"
            ? "No one matches these filters. Make a wish and the board will find you a teacher."
            : "No open requests match. Check back after the next wish."}
        </Empty>
      ) : (
        <BoardList list={list} />
      )}
    </Page>
  );
}
