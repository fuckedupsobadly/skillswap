"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setOnboardingStep, setPlainMode } from "@/app/actions/village";
import { PixelIcon } from "@/ui/pixel/icons";
import { Dots } from "../board/parts";

/** The whole idea in three moves — the first thing a newcomer reads. A real sequence, so it's numbered. */
const HOW: { icon: Parameters<typeof PixelIcon>[0]["name"]; title: string; body: string }[] = [
  {
    icon: "search",
    title: "Make a wish",
    body: "Tell the Wishing Well what you'd like to learn. It costs nothing to ask.",
  },
  {
    icon: "lantern",
    title: "Find a lit lantern",
    body: "A gold lantern in a window means that neighbour can teach you right now.",
  },
  {
    icon: "hourglass",
    title: "Teach an hour back",
    body: "Every hour you teach earns an hour to learn. You start with 2 h.",
  },
];

const KEYS: [string, string][] = [
  ["Walk", "WASD or the arrows, or click the ground. Shift runs."],
  ["E", "Talk, read or enter whatever is in front of you"],
  ["M", "The map: jump to any place"],
  ["/", "Search skills, members and places"],
  ["T", "Say something to people nearby"],
  ["F", "Full screen"],
];

export function GateWelcome({ firstVisit }: { firstVisit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6">
      {firstVisit ? <Dots step={1} /> : null}
      <p className="text-body">
        Welcome to the village. Everyone here teaches something and learns something, and one hour is always
        worth one hour.
      </p>

      <ol className="grid gap-3 sm:grid-cols-3">
        {HOW.map((h, i) => (
          <li key={h.title} className="window grid content-start gap-1.5 px-3 pt-2.5 pb-3">
            <span className="flex items-center gap-2">
              <span className="grid size-6 place-items-center bg-ink font-pixel text-meta text-paper">
                {i + 1}
              </span>
              <PixelIcon name={h.icon} size={16} />
            </span>
            <span className="font-pixel text-label">{h.title}</span>
            <span className="text-meta text-ink-soft">{h.body}</span>
          </li>
        ))}
      </ol>

      {firstVisit ? (
        <p className="text-meta text-ink-soft">
          Next: make your villager, pick a kitten, then walk to the Well. Under two minutes, and you can skip
          any step.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {firstVisit ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setOnboardingStep({ step: 2 });
                router.replace("/gate/villager");
              })
            }
          >
            Enter the village
          </button>
        ) : (
          <Link href="/gate/villager" className="btn btn-secondary">
            Change your villager
          </Link>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setPlainMode({ on: true });
              if (firstVisit) await setOnboardingStep({ step: 99 });
              window.location.href = "/board";
            })
          }
        >
          Use Plain mode
        </button>
        <span className="text-meta text-ink-soft">Same village as simple pages, no walking.</span>
      </div>

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-pixel text-label">
          <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
            ▸
          </span>
          Controls
        </summary>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 pt-2">
          {KEYS.map(([k, d]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="keycap">{k}</kbd>
              </dt>
              <dd className="text-meta">{d}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
