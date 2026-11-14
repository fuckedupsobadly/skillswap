import Link from "next/link";
import { GUILDS } from "@/modules/village/guilds";
import { PLACES } from "@/modules/village/map";
import { Page, Section } from "@/ui/bits";
import { PixelIcon } from "@/ui/pixel/icons";

export const metadata = { title: "Village map" };

const DISTRICTS = ["Town Square", "Guild Quarter", "South"] as const;

/** The map's plain twin (§9): every place in the village as a link, grouped the way they sit in the world. */
export default function MapPage() {
  return (
    <Page
      title="The village"
      sub="Every place, one click away. Walking is only for fun."
      action={
        <a href="/?village=1" className="btn btn-secondary">
          Open the map
        </a>
      }
    >
      {DISTRICTS.map((d) => (
        <Section key={d} title={d}>
          <ul className="grid">
            {PLACES.filter((p) => p.district === d).map((p) => {
              const g = p.id.startsWith("guild-") ? GUILDS.find((x) => `guild-${x.id}` === p.id) : null;
              return (
                <li key={p.id} className="border-t-2 border-paper-shade first:border-t-0">
                  <Link href={p.route} className="group flex min-h-11 items-center gap-3 py-2">
                    {g ? (
                      <span
                        aria-hidden
                        className="grid h-7 w-7 shrink-0 place-items-center"
                        style={{ background: g.roof }}
                      >
                        <PixelIcon name={g.icon} size={16} />
                      </span>
                    ) : null}
                    <span className="grid min-w-0 flex-1">
                      <span className="font-pixel text-label group-hover:underline group-hover:underline-offset-4">
                        {p.name}
                      </span>
                      <span className="text-meta text-ink-soft">{p.blurb}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
      <Section title="Residential Lanes">
        <p className="text-ink-soft">
          Every hut belongs to a real member. Find someone on the{" "}
          <Link href="/board" className="text-ink underline underline-offset-4">
            Notice Board
          </Link>
          , or go to{" "}
          <Link href="/hut" className="text-ink underline underline-offset-4">
            your hut
          </Link>
          .
        </p>
      </Section>
    </Page>
  );
}
