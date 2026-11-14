"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While someone else has to act (a sample member accepting, the other side confirming), re-read the page. */
export function AutoRefresh({ everyMs = 2500, forMs = 120_000 }: { everyMs?: number; forMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > forMs || document.hidden) return;
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, forMs]);
  return null;
}
