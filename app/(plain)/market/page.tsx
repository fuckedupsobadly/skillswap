import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { boardRows } from "@/modules/village/board";
import { MARKET } from "@/modules/village/guilds";
import { Columns, Empty, Page, Section, Stack } from "@/ui/bits";
import { BoardList } from "../board/list";

export const metadata = { title: "Market Row" };

/** Market Row (§3.1): career and business skills, plus the Plus booth — clearly labelled, it sells no hours. */
export default async function Market() {
  const viewer = await getViewer();
  if (!viewer) redirect("/gate");
  const db = await getDb();
  const [offers, requests] = await Promise.all([
    boardRows(db, viewer.memberId, { tab: "offers", guild: MARKET.id }),
    boardRows(db, viewer.memberId, { tab: "requests", guild: MARKET.id }),
  ]);
  return (
    <Page
      title="Market Row"
      sub="Career and business skills: CVs, interviews, pitching, spreadsheets for work."
      scene={{ place: "market" }}
    >
      <Columns>
        <Section title="At the stalls" icon="sign">
          {offers.length ? (
            <BoardList list={offers} />
          ) : (
            <Empty
              action={
                <Link href="/hut#skills" className="btn btn-secondary">
                  Open a stall
                </Link>
              }
            >
              No one is teaching career skills yet.
            </Empty>
          )}
        </Section>
        <Stack>
          {requests.length ? (
            <Section title="Wanted" icon="search">
              <BoardList list={requests} />
            </Section>
          ) : null}
          <Section title="The Plus booth" icon="hourglass">
            <div className="window grid gap-2 px-4 py-3">
              <p>
                Plus is an optional subscription that keeps the village running: more time with the Barkeep,
                earlier swap matches and bigger group classes.
              </p>
              <p className="font-medium">
                It sells no hours and no XP. One hour is always one hour, for everyone.
              </p>
              <p className="text-meta text-ink-soft">
                The booth is closed in this demo. Nothing here takes payment.
              </p>
            </div>
          </Section>
        </Stack>
      </Columns>
    </Page>
  );
}
