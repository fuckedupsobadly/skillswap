"use client";
import { X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { LEVELS } from "@/modules/platform/format";
import { Input, Select } from "./field";

export type SkillOption = { id: string; name: string; category: string };
export type Picked = { skillId: string; level: number };

/** Combobox over the taxonomy + a level per pick. Keyboard: type, arrow to a result, Enter to add. */
export function SkillPicker({
  options,
  value,
  onChange,
  levelLabel,
  defaultLevel,
  max = 6,
}: {
  options: SkillOption[];
  value: Picked[];
  onChange: (v: Picked[]) => void;
  levelLabel: string;
  defaultLevel: number;
  max?: number;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return options
      .filter((o) => !value.some((v) => v.skillId === o.id))
      .filter((o) => o.name.toLowerCase().includes(t) || o.category.toLowerCase().includes(t))
      .slice(0, 6);
  }, [q, options, value]);

  const add = (o: SkillOption) => {
    if (value.length >= max) return;
    onChange([...value, { skillId: o.id, level: defaultLevel }]);
    setQ("");
    setActive(0);
  };

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          placeholder={value.length >= max ? `Up to ${max} skills` : "Type a skill, e.g. Python or guitar"}
          disabled={value.length >= max}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              add(results[active]);
            }
          }}
        />
        {results.length ? (
          <div
            id={listId}
            role="listbox"
            tabIndex={-1}
            className="absolute inset-x-0 top-12 z-20 overflow-hidden border-2 border-paper-shade bg-paper shadow-lg"
          >
            {results.map((o, i) => (
              // Focus stays in the input (combobox pattern); options are picked by click or Enter there.
              <div
                key={o.id}
                id={`${listId}-${o.id}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o)}
                onKeyDown={(e) => e.key === "Enter" && add(o)}
                className={`flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left text-body ${i === active ? "bg-paper-shade" : ""}`}
              >
                {o.name} <span className="text-meta text-ink-soft">{o.category}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {value.length ? (
        <ul className="divide-y divide-line border-2 border-paper-shade">
          {value.map((v) => (
            <li key={v.skillId} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 text-body">{byId.get(v.skillId)?.name}</span>
              <label className="sr-only" htmlFor={`lvl-${v.skillId}`}>
                {levelLabel}
              </label>
              <Select
                id={`lvl-${v.skillId}`}
                className="h-9 w-36 text-meta"
                value={v.level}
                onChange={(e) =>
                  onChange(
                    value.map((x) => (x.skillId === v.skillId ? { ...x, level: Number(e.target.value) } : x)),
                  )
                }
              >
                {LEVELS.slice(1).map((l, i) => (
                  <option key={l} value={i + 1}>
                    {l}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                aria-label={`Remove ${byId.get(v.skillId)?.name}`}
                onClick={() => onChange(value.filter((x) => x.skillId !== v.skillId))}
                className="inline-flex h-9 items-center gap-1 px-2 text-meta text-ink-soft hover:bg-paper-shade hover:text-ink"
              >
                <X size={14} aria-hidden /> Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const AVAILABILITY_PRESETS = {
  anytime: {
    label: "Any time",
    rules: Array.from({ length: 7 }, (_, d) => ({ weekday: d, startMin: 0, endMin: 1440 })),
  },
  evenings: {
    label: "Weekday evenings",
    rules: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, startMin: 18 * 60, endMin: 22 * 60 })),
  },
  weekends: {
    label: "Weekends",
    rules: [0, 6].map((d) => ({ weekday: d, startMin: 9 * 60, endMin: 19 * 60 })),
  },
  mornings: {
    label: "Mornings",
    rules: Array.from({ length: 7 }, (_, d) => ({ weekday: d, startMin: 7 * 60, endMin: 10 * 60 })),
  },
  workday: {
    label: "Weekday daytime",
    rules: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, startMin: 9 * 60, endMin: 17 * 60 })),
  },
} as const;
export type PresetKey = keyof typeof AVAILABILITY_PRESETS;
