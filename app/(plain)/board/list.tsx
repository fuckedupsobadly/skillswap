import type { boardRows } from "@/modules/village/board";
import { PixelIcon } from "@/ui/pixel/icons";
import { BoardRowActions } from "./parts";

export type BoardRowData = Awaited<ReturnType<typeof boardRows>>[number];

/** Board rows are cards because they're clickable (§10.3); the square pin is the guild colour plus its sign. */
export function BoardList({ list }: { list: BoardRowData[] }) {
  return (
    <ul className="grid gap-2">
      {list.map((r) => (
        <li key={r.id} className="card flex flex-wrap items-center gap-3 px-3 py-2">
          {/* Square pin in the guild colour, always with its sign (§8.2, §9). */}
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center"
            style={{ background: r.color }}
          >
            <PixelIcon name={r.icon} size={16} />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-medium">{r.title}</span>
            <span className="text-meta text-ink-soft">
              {r.guild} · {r.who} · {r.status}
              {"sample" in r && r.sample ? " · Sample" : ""}
            </span>
          </div>
          <BoardRowActions
            row={{
              kind: r.kind,
              id: r.id,
              handle: r.handle,
              who: r.who,
              free: "presence" in r && r.presence === "free",
              title: r.title,
              mine: r.mine,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
