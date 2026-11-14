import Link from "next/link";
import { getViewer } from "@/app/_lib/viewer";
import { getDb } from "@/db/client";
import { walletSummary } from "@/modules/ledger/service";
import { formatHours } from "@/modules/platform/format";
import { unreadCount } from "@/modules/village/service";
import { PixelIcon } from "./pixel/icons";

const LINKS = [
  { href: "/board", label: "Notice Board" },
  { href: "/tavern", label: "Tavern" },
  { href: "/bank", label: "Bank" },
  { href: "/sessions", label: "Lantern Rooms" },
  { href: "/hut", label: "Your hut" },
] as const;

/** Plain mode chrome: wordmark, places as links, balance, inbox, and the way back into the village. */
export async function PlainHeader() {
  const viewer = await getViewer();
  const db = viewer ? await getDb() : null;
  const [wallet, unread] =
    viewer && db
      ? await Promise.all([walletSummary(db, viewer.memberId), unreadCount(db, viewer.memberId)])
      : [null, 0];
  return (
    <header className="border-b-2 border-paper-shade bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:p-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/board" className="font-name text-name">
          SkillSwap Village
        </Link>
        <nav aria-label="Places" className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-pixel text-label hover:underline hover:underline-offset-4"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/inbox" className="font-pixel text-label hover:underline hover:underline-offset-4">
            Inbox{unread ? <span className="tnum ml-1 font-sans text-meta">({unread})</span> : null}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {wallet ? (
            <Link
              href="/bank"
              className="flex items-center gap-1.5 text-body"
              aria-label={`Balance ${formatHours(wallet.balanceMin)}`}
            >
              <PixelIcon name="hourglass" size={16} />
              <span className="tnum font-medium">{formatHours(wallet.balanceMin)}</span>
              {wallet.heldMin ? (
                <span className="tnum text-meta text-ink-soft">
                  ({formatHours(wallet.heldMin).replace(" h", "")} held)
                </span>
              ) : null}
            </Link>
          ) : null}
          <a href="/?village=1" className="btn btn-secondary">
            Enter the village
          </a>
        </div>
      </div>
    </header>
  );
}
