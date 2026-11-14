"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setHideMe, setPlainMode } from "@/app/actions/village";
import { FormError } from "@/ui/field";
import { SwitchRow } from "@/ui/switch";

/** How you see the village, and how it sees you (§9, §14 privacy). */
export function VillageSettings({ plain: p0, hideMe: h0 }: { plain: boolean; hideMe: boolean }) {
  const router = useRouter();
  const [plain, setPlain] = useState(p0);
  const [hide, setHide] = useState(h0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        <SwitchRow
          id="set-plain"
          label="Plain mode"
          hint="Open SkillSwap as standard pages instead of the village. Same features, no walking."
          on={plain}
          disabled={pending}
          onToggle={() =>
            start(async () => {
              setError(null);
              const r = await setPlainMode({ on: !plain });
              if (!r.ok) return setError(r.error);
              setPlain(!plain);
              router.refresh();
            })
          }
        />
        <SwitchRow
          id="set-hide"
          label="Hide me"
          hint="Others see only your hut, never where you are walking."
          on={hide}
          disabled={pending}
          onToggle={() =>
            start(async () => {
              setError(null);
              const r = await setHideMe({ on: !hide });
              if (!r.ok) return setError(r.error);
              setHide(!hide);
            })
          }
        />
      </ul>
      <p className="text-meta text-ink-soft">
        Motion follows your system setting: with reduced motion on, the village quick-travels instead of
        walking and the weather stays still.
      </p>
      <FormError message={error} />
    </div>
  );
}
