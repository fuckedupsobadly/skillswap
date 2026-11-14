import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** §10.3 inputs: paper fill, 2 px ink border with stepped corners; focus ring per §9. */
export const Input = ({ className, ...p }: ComponentProps<"input">) => (
  <input className={cn("field", className)} {...p} />
);
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => (
  <textarea className={cn("field min-h-24 py-2.5", className)} {...p} />
);
export const Select = ({ className, ...p }: ComponentProps<"select">) => (
  <select className={cn("field pr-8", className)} {...p} />
);

/** Labels use the pixel face (short text only); hints are body text. */
export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={htmlFor} className="font-pixel text-label">
        {label}
      </label>
      {children}
      {hint ? <p className="text-meta text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Errors say what went wrong and how to fix it, in the interface's voice. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-body text-danger">
      {message}
    </p>
  );
}
