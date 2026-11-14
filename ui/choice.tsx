"use client";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type ChoiceOption<T extends string | number> = {
  value: T;
  label?: ReactNode;
  aria?: string;
  swatch?: string;
  disabled?: boolean;
};

/**
 * One choice from a short row (length, day, time, status, colour): real radio inputs, so arrow keys, forms and
 * screen readers all work. The chosen option wears the pressed paper-shade frame (§10.1), never gold.
 * `legend` is visually hidden when the row sits beside its own pixel label.
 */
export function ChoiceRow<T extends string | number>({
  name,
  legend,
  showLegend = false,
  value,
  options,
  onChange,
  className,
  disabled,
  small = false,
}: {
  name: string;
  legend: string;
  showLegend?: boolean;
  value: T | null;
  options: ChoiceOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  disabled?: boolean;
  /** Smaller swatches for long colour rows; still a 44 px tall target. */
  small?: boolean;
}) {
  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className={showLegend ? "mb-1.5 font-pixel text-label" : "sr-only"}>{legend}</legend>
      <div
        className={cn(
          "flex flex-wrap items-center",
          small || options.some((o) => o.swatch) ? "gap-0" : "gap-1",
        )}
      >
        {options.map((o) =>
          o.swatch ? (
            <label
              key={String(o.value)}
              className={cn("grid h-11 cursor-pointer place-items-center", small ? "w-7" : "w-9")}
              title={o.aria}
            >
              <input
                type="radio"
                name={name}
                className="peer sr-only"
                checked={value === o.value}
                disabled={o.disabled}
                aria-label={o.aria}
                onChange={() => onChange(o.value)}
              />
              <span
                aria-hidden
                className={cn(
                  "block outline-offset-2 peer-checked:outline-2 peer-checked:outline-ink peer-checked:outline-solid peer-focus-visible:outline-2 peer-focus-visible:outline-ink peer-focus-visible:outline-dashed",
                  small ? "h-4 w-4 ring-1 ring-ink-faint" : "h-7 w-7",
                )}
                style={{ background: o.swatch }}
              />
            </label>
          ) : (
            <label
              key={String(o.value)}
              className="btn btn-tertiary cursor-pointer px-3 has-checked:btn-pressed has-checked:no-underline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink has-disabled:opacity-45"
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={value === o.value}
                disabled={o.disabled}
                aria-label={o.aria}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
