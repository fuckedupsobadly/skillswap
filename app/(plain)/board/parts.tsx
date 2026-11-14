"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSkills } from "@/app/actions/profile";
import { sendNote, setOnboardingStep } from "@/app/actions/village";
import { categoryColor } from "@/modules/village/guilds";
import { ShowOnMap } from "@/ui/show-on-map";
import { useToWorld } from "@/ui/to-world";

/** Row actions: Book (lantern only when the teacher is free now), Show on map, or Offer to teach. */
export function BoardRowActions({
  row,
}: {
  row: {
    kind: "offer" | "request";
    id: string;
    handle: string;
    who: string;
    free: boolean;
    title: string;
    mine: boolean;
  };
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (row.kind === "request") {
    if (row.mine) return <span className="text-meta text-ink-soft">Your wish</span>;
    return sent ? (
      <span className="text-meta text-ok">Note left</span>
    ) : (
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendNote({
              to: row.handle,
              body: `I saw your wish on the Notice Board (${row.title}). I can teach this — book me or swap with me.`,
            });
            if (r.ok) setSent(true);
          })
        }
      >
        Offer to teach
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <ShowOnMap handle={row.handle} />
      <button
        type="button"
        className={row.free ? "btn btn-primary" : "btn btn-secondary"}
        onClick={() => router.push(`/book/${row.id}${row.free ? "?now=1&len=30" : ""}`)}
      >
        Book
      </button>
    </div>
  );
}

const POPULAR = [
  "English",
  "Python",
  "Excel and spreadsheets",
  "Home cooking",
  "Guitar",
  "Photography",
  "Public speaking",
  "Math",
  "Spanish",
  "Chess",
  "Figma",
  "Interview practice",
];

/** Onboarding step 6 (§11): pick what you can teach — three taps. */
export function TeachPicker({ skills }: { skills: { id: string; name: string; category: string }[] }) {
  const toWorld = useToWorld();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const options = POPULAR.map((n) => skills.find((s) => s.name === n)).filter(Boolean) as typeof skills;
  const finish = (save: boolean) =>
    start(async () => {
      if (save && picked.length)
        await saveSkills({ teach: picked.map((skillId) => ({ skillId, level: 4 })), learn: [] });
      await setOnboardingStep({ step: 7 });
      toWorld();
    });
  return (
    <section className="grid gap-3 bg-paper-shade p-4" aria-label="What can you teach?">
      <Dots step={6} />
      <h2 className="font-pixel text-label">What can you teach? Pick up to three.</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => {
          const on = picked.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setPicked(
                  on ? picked.filter((x) => x !== s.id) : picked.length < 3 ? [...picked, s.id] : picked,
                )
              }
              className={`btn ${on ? "btn-secondary" : "btn-tertiary"} gap-2`}
            >
              <span aria-hidden className="h-3 w-3" style={{ background: categoryColor(s.category) }} />
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || !picked.length}
          onClick={() => finish(true)}
        >
          Done
        </button>
        <button type="button" className="btn btn-tertiary" disabled={pending} onClick={() => finish(false)}>
          Skip
        </button>
      </div>
    </section>
  );
}

/** Progress dot row at the top of each onboarding sheet (§11). */
export function Dots({ step, total = 7 }: { step: number; total?: number }) {
  return (
    <ol aria-label={`Step ${step} of ${total}`} className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          aria-hidden
          className={`h-2 w-2 ${i < step ? "bg-ink" : "bg-paper-shade outline outline-1 outline-ink"}`}
        />
      ))}
    </ol>
  );
}
