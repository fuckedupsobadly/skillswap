"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Parchment sheet (§8): slides up from the bottom on phones, opens centred on desktop, over a dimmed world
 * that keeps moving behind it. Esc or a click on the world closes it. The same page component renders here
 * and as the plain twin page.
 */
export function Sheet({ children, label }: { children: React.ReactNode; label?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>("input, textarea, select, button, a[href]")?.focus({
      preventScroll: true,
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
      if (e.key !== "Tab" || !el) return;
      // keep focus inside the sheet
      const f = [
        ...el.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [router]);
  return (
    <div
      data-sheet-open
      className="fixed inset-0 z-[55] flex items-end justify-center bg-[rgb(43_27_51/0.28)] sm:items-center sm:p-6"
      onPointerDown={(e) => e.target === e.currentTarget && router.back()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="anim-sheet-up outline-none sm:anim-sheet max-h-[92dvh] w-full max-w-[648px] overflow-y-auto pr-1 pb-1 [&>div]:max-w-none [&>div]:p-0"
      >
        {children}
      </div>
    </div>
  );
}
