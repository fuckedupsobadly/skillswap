"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Result } from "@/app/_lib/run";
import { saveAvailability, saveProfile, saveSkills } from "@/app/actions/profile";
import { Button } from "@/ui/button";
import { Field, FormError, Input, Textarea } from "@/ui/field";
import {
  AVAILABILITY_PRESETS,
  type Picked,
  type PresetKey,
  type SkillOption,
  SkillPicker,
} from "@/ui/skill-picker";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = (fn: () => Promise<Result<unknown>>) =>
    start(async () => {
      setError(null);
      setSaved(false);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  return { pending, error, saved, save };
}

const Status = ({ error, saved }: { error: string | null; saved: boolean }) => (
  <>
    <FormError message={error} />
    {saved ? <p className="text-meta text-ok">Saved.</p> : null}
  </>
);

export function ProfileForm({
  initial,
}: {
  initial: { displayName: string; bio: string; timezone: string; languages: string[] };
}) {
  const [v, setV] = useState({ ...initial, languages: initial.languages.join(", ") });
  const s = useSave();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        s.save(() =>
          saveProfile({
            ...v,
            languages: v.languages
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          }),
        );
      }}
    >
      <Field label="Display name" htmlFor="name">
        <Input
          id="name"
          value={v.displayName}
          onChange={(e) => setV({ ...v, displayName: e.target.value })}
        />
      </Field>
      <Field label="Short bio" htmlFor="bio">
        <Textarea
          id="bio"
          value={v.bio}
          maxLength={280}
          onChange={(e) => setV({ ...v, bio: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timezone" htmlFor="tz">
          <Input id="tz" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
        </Field>
        <Field label="Languages" htmlFor="langs" hint="Comma-separated">
          <Input id="langs" value={v.languages} onChange={(e) => setV({ ...v, languages: e.target.value })} />
        </Field>
      </div>
      <Status error={s.error} saved={s.saved} />
      <Button type="submit" disabled={s.pending} className="justify-self-start">
        Save profile
      </Button>
    </form>
  );
}

export function SkillsForm({
  options,
  teach: t0,
  learn: l0,
}: {
  options: SkillOption[];
  teach: Picked[];
  learn: Picked[];
}) {
  const [teach, setTeach] = useState(t0);
  const [learn, setLearn] = useState(l0);
  const s = useSave();
  return (
    <div className="grid gap-4">
      <Field label="I can teach">
        <SkillPicker
          options={options}
          value={teach}
          onChange={setTeach}
          levelLabel="Your level"
          defaultLevel={4}
        />
      </Field>
      <Field label="I want to learn">
        <SkillPicker
          options={options}
          value={learn}
          onChange={setLearn}
          levelLabel="Your current level"
          defaultLevel={1}
        />
      </Field>
      <Status error={s.error} saved={s.saved} />
      <Button
        disabled={s.pending}
        className="justify-self-start"
        onClick={() => s.save(() => saveSkills({ teach, learn }))}
      >
        Save skills
      </Button>
    </div>
  );
}

export function AvailabilityForm({
  rules,
  timezone,
}: {
  rules: { weekday: number; startMin: number; endMin: number }[];
  timezone: string;
}) {
  const initial = (Object.keys(AVAILABILITY_PRESETS) as PresetKey[]).filter((k) =>
    AVAILABILITY_PRESETS[k].rules.every((r) =>
      rules.some((x) => x.weekday === r.weekday && x.startMin === r.startMin && x.endMin === r.endMin),
    ),
  );
  const [presets, setPresets] = useState<PresetKey[]>(
    rules.length === 0 ? ["anytime"] : initial.includes("anytime") ? ["anytime"] : initial,
  );
  const s = useSave();
  return (
    <div className="grid gap-3">
      <p className="text-meta text-ink-soft">Times in {timezone.replace("_", " ")}.</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(AVAILABILITY_PRESETS) as PresetKey[]).map((k) => {
          const on = presets.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setPresets((p) =>
                  on
                    ? p.filter((x) => x !== k)
                    : k === "anytime"
                      ? ["anytime"]
                      : [...p.filter((x) => x !== "anytime"), k],
                )
              }
              className={`h-9 border px-3 text-meta ${on ? "border-ink font-semibold text-ink" : "border-paper-shade text-ink-soft"}`}
            >
              {AVAILABILITY_PRESETS[k].label}
            </button>
          );
        })}
      </div>
      <Status error={s.error} saved={s.saved} />
      <Button
        disabled={s.pending || presets.length === 0}
        className="justify-self-start"
        onClick={() =>
          s.save(() =>
            saveAvailability({ rules: presets.flatMap((p) => [...AVAILABILITY_PRESETS[p].rules]) }),
          )
        }
      >
        Save availability
      </Button>
    </div>
  );
}
