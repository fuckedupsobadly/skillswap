"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { SheetContext } from "./sheet-context";

/**
 * Parchment sheet (§8): opens over a dimmed world that keeps moving behind it — slides up on phones, settles
 * in the middle on desktop. Esc, the × in its corner, or a click anywhere outside the parchment closes it.
 * The same page component renders here and as the plain twin page.
 */
export function Sheet({ children, label }: { children: React.ReactNode; label?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => router.back(), [router]);
  const ctx = useMemo(() => ({ close }), [close]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // Focus the sheet itself: it opens at the top, a screen reader reads its name, Tab reaches the controls.
    el?.focus({ preventScroll: true });
    if (el) el.scrollTop = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !el) return;
      // keep focus inside the sheet
      const f = [
        ...el.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (!f.length) return;
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === el)) {
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
  }, [close]);
  return (
    <SheetContext.Provider value={ctx}>
      <div
        data-sheet-open
        aria-hidden
        className="anim-fade fixed inset-0 z-[55] bg-[radial-gradient(ellipse_at_center,rgb(43_27_51/0.16)_0%,rgb(43_27_51/0.42)_100%)]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        // a click on the world around the parchment (this scroller, or the page's own margin) closes it
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t === e.currentTarget || t.hasAttribute("data-page-outer")) close();
        }}
        className="anim-sheet-up sm:anim-sheet fixed inset-0 z-[56] overflow-y-auto overscroll-contain outline-none"
      >
        {children}
      </div>
    </SheetContext.Provider>
  );
}
