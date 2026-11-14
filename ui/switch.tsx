"use client";
import { cn } from "./cn";

/**
 * A pixel switch: ink border, paper-shade track when off, ink track when on, a paper knob that steps across.
 * Never lantern gold — gold is only for the primary action and lit lanterns (§10.1).
 */
export function Switch({
  on,
  onToggle,
  labelledBy,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onToggle}
      className="group grid h-11 w-14 shrink-0 place-items-center disabled:opacity-60"
    >
      <span className={cn("relative block h-6 w-11 border-2 border-ink", on ? "bg-ink" : "bg-paper-shade")}>
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 border-2 border-ink bg-paper transition-[left] duration-[120ms] ease-[steps(4)] motion-reduce:transition-none",
            on ? "left-[21px] border-paper" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** A settings row: name in the pixel face, one line of explanation, the switch on the right. */
export function SwitchRow({
  id,
  label,
  hint,
  on,
  onToggle,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <span id={id} className="font-pixel text-label">
          {label}
        </span>
        <span className="text-meta text-ink-soft">{hint}</span>
      </div>
      <Switch on={on} onToggle={onToggle} labelledBy={id} disabled={disabled} />
    </li>
  );
}
