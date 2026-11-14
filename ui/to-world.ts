"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Back to the world. Over the village (a sheet is open) this replaces the URL with "/", which empties the
 * sheet slot without restarting the world; from a plain page it opens the village.
 */
export function useToWorld() {
  const router = useRouter();
  return useCallback(
    (then?: () => void) => {
      if (document.querySelector("[data-sheet-open]")) {
        router.replace("/", { scroll: false });
        if (then) window.setTimeout(then, 150);
      } else window.location.href = "/?village=1";
    },
    [router],
  );
}
