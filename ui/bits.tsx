import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatHours } from "@/modules/platform/format";
import { cn } from "./cn";

/**
 * Panel page (§10.3/§10.4): a parchment panel, max 640 px, one column, 24 px padding. The same component is
 * the plain twin page and the sheet the village opens over the world.
 */
export function Page({
  title,
  sub,
  children,
  action,
  narrow: _narrow,
}: {
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pt-8 pb-24 sm:pt-12">
      <article className="panel grid gap-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-name text-name">{title}</h1>
            {sub ? <p className="text-body text-ink-soft">{sub}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </article>
    </div>
  );
}

/** A section inside a panel: a short pixel label, then content; separated by a paper-shade divider. */
export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="divider grid gap-3 pt-5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="font-pixel text-label">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Static content is plain — no frame. (Cards exist only for clickable rows: see Row with href.) */
export const Card = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("grid gap-2", className)} {...p} />
);

/** A list of rows separated by dividers. Rows that link somewhere become cards (they're clickable). */
export function Row({
  href,
  children,
  className,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  if (href)
    return (
      <Link
        href={href}
        className={cn(
          "card flex min-h-14 items-center gap-3 px-3 py-2 hover:[filter:drop-shadow(3px_3px_0_var(--ink-faint))]",
          className,
        )}
      >
        {children}
      </Link>
    );
  return <div className={cn("flex min-h-12 items-center gap-3 py-2", className)}>{children}</div>;
}

export const List = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("grid gap-2 [&>div+div]:border-t-2 [&>div+div]:border-paper-shade", className)}>
    {children}
  </div>
);

/** Amounts of hours are written in hours — "1 h", "0.5 h" — in Inter with tabular figures. */
export function Hours({
  min,
  sign,
  mine: _mine,
  className,
}: {
  min: number;
  sign?: boolean;
  mine?: boolean;
  className?: string;
}) {
  return <span className={cn("tnum", className)}>{formatHours(min, { sign })}</span>;
}

/** Status is always written in words (§9); the pill is just paper-shade behind the text. */
export const Pill = ({ children }: { tone?: string; children: ReactNode }) => (
  <span className="inline-flex min-h-6 items-center bg-paper-shade px-2 text-meta">{children}</span>
);
export const Chip = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex min-h-7 items-center bg-paper-shade px-2 text-meta", className)}>
    {children}
  </span>
);

/** Seeded demo members are always labelled. */
export const SampleBadge = () => <span className="text-meta text-ink-soft">Sample</span>;

/** An empty state is an invitation to act: one sentence, then the action. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-3 py-2 text-body text-ink-soft">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Stars({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-meta text-ink-soft">No reviews yet</span>;
  return (
    <span className="tnum text-meta" title={`${value.toFixed(2)} out of 5`}>
      {value.toFixed(1)}
      {count !== undefined ? ` (${count})` : ""}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center bg-paper-shade font-pixel text-meta"
    >
      {initials}
    </span>
  );
}

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => (
  <code className={cn("break-all font-mono text-meta", className)}>{children}</code>
);
