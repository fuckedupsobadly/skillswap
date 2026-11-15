import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatHours } from "@/modules/platform/format";
import { cn } from "./cn";
import type { IconName } from "./pixel/icons";
import { PixelIcon } from "./pixel/icons";
import { PlaceBanner, type Scene } from "./place-banner";
import { SheetClose } from "./sheet-context";

/**
 * A place's sheet (§8), and the same page in Plain mode. Parchment with a printed inner rule; when the page
 * belongs to a place, its pixel vignette runs across the top and the name hangs on a wooden sign over the
 * vignette's edge. `size` picks a reading width: forms and scrolls stay narrow, boards and ledgers go wide
 * and split into two columns once the panel has room (container query, so a sheet and a page agree).
 */
export function Page({
  title,
  sub,
  children,
  action,
  scene,
  size = "wide",
}: {
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  scene?: Scene;
  size?: "narrow" | "wide";
  /** @deprecated */
  narrow?: boolean;
}) {
  return (
    <div
      data-page-outer
      className={cn(
        "mx-auto w-full px-4 pt-8 pb-24 sm:pt-10",
        size === "narrow" ? "max-w-[688px]" : "max-w-[1088px]",
      )}
    >
      <article
        className={cn(
          "panel parchment @container relative grid gap-8 px-6 pb-8 sm:px-8",
          scene ? "" : "pt-7",
        )}
      >
        {scene ? <PlaceBanner scene={scene} className="-mx-6 border-b-2 border-ink sm:-mx-8" /> : null}
        <SheetClose />
        <header className={cn("relative grid gap-3", scene ? "-mt-[60px]" : "")}>
          <h1 className="sign relative justify-self-start px-4 py-1.5 font-name text-name">
            {/* two nails hold the sign up */}
            <span aria-hidden className="absolute top-1 left-1.5 size-1 bg-ink/60" />
            <span aria-hidden className="absolute top-1 right-1.5 size-1 bg-ink/60" />
            {title}
          </h1>
          {sub || action ? (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              {sub ? (
                typeof sub === "string" ? (
                  <p className="max-w-[68ch] text-ink-soft">{sub}</p>
                ) : (
                  <div className="min-w-0 max-w-[68ch] text-ink-soft">{sub}</div>
                )
              ) : (
                <span />
              )}
              {action}
            </div>
          ) : null}
        </header>
        {children}
      </article>
    </div>
  );
}

/** Two columns once the panel is wide enough; one column on narrow panels and phones. */
export const Columns = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("grid items-start gap-8 @3xl:grid-cols-2 @3xl:gap-10", className)}>{children}</div>
);
export const Stack = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("grid content-start gap-8", className)}>{children}</div>
);

/** A section: a small pixel icon (or a square stud), the heading, and a stitched rule running to the edge. */
export function Section({
  title,
  children,
  aside,
  icon,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  icon?: IconName;
}) {
  return (
    <section className="grid content-start gap-3">
      <div className="flex min-h-8 items-center gap-2.5">
        {icon ? <PixelIcon name={icon} size={16} /> : <span aria-hidden className="size-2 shrink-0 bg-ink" />}
        <h2 className="font-pixel text-label whitespace-nowrap">{title}</h2>
        <span aria-hidden className="h-0 min-w-6 flex-1 border-t-2 border-dashed border-paper-shade" />
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
