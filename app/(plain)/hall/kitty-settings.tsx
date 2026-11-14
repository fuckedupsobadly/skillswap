"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGameSettings } from "@/app/actions/game";
import { FormError } from "@/ui/field";
import { SwitchRow } from "@/ui/switch";

type S = { showKitty: boolean; roam: boolean; notices: boolean; showRank: boolean };

const ROWS: { key: keyof S; label: string; hint: string }[] = [
  {
    key: "showKitty",
    label: "Show my kitty",
    hint: "Hides the kitty and its button everywhere. Progress keeps counting quietly.",
  },
  {
    key: "roam",
    label: "Let it roam",
    hint: "Off keeps it in its corner, changing pose now and then.",
  },
  { key: "notices", label: "Game notices", hint: "One quiet line for XP, level-ups and unlocks." },
  { key: "showRank", label: "Show rank and badges", hint: "Your kitty is always shown." },
];

export function KittySettings({ initial, kittyName }: { initial: S; kittyName: string | null }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (key: keyof S) =>
    start(async () => {
      const next = { ...s, [key]: !s[key] };
      setS(next);
      const res = await saveGameSettings({ [key]: next[key] });
      if (!res.ok) {
        setS(s);
        return setError(res.error);
      }
      // The kitty layer reads its settings on load.
      if (key === "showKitty" || key === "roam") window.location.reload();
      else router.refresh();
    });
  return (
    <div className="grid gap-4">
      {kittyName ? null : (
        <p className="text-body text-ink-soft">
          You haven't adopted a kitty yet.{" "}
          <Link href="/gate/kitty" className="font-medium text-ink underline underline-offset-4">
            Pick one of three kittens
          </Link>
        </p>
      )}
      <ul className="grid gap-3">
        {ROWS.map((r) => (
          <SwitchRow
            key={r.key}
            id={`set-${r.key}`}
            label={r.label}
            hint={r.hint}
            on={s[r.key]}
            onToggle={() => toggle(r.key)}
            disabled={pending}
          />
        ))}
      </ul>
      <p className="text-meta text-ink-soft">
        Sound stays off: the kitty is silent, and never makes a sound during a session.
      </p>
      <FormError message={error} />
    </div>
  );
}
