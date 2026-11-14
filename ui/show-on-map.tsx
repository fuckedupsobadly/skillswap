"use client";
import { useToWorld } from "./to-world";

/**
 * "Show on map" (§8.2): over the world, close the sheet and quick-travel to the hut; from a plain page, open
 * the village there.
 */
export function useShowOnMap() {
  const toWorld = useToWorld();
  return (handle: string) => {
    if (document.querySelector("[data-sheet-open]"))
      toWorld(() => window.dispatchEvent(new CustomEvent("village:show", { detail: handle })));
    else window.location.href = `/?village=1&show=${encodeURIComponent(handle)}`;
  };
}

export function ShowOnMap({
  handle,
  className = "btn btn-tertiary",
}: {
  handle: string;
  className?: string;
}) {
  const show = useShowOnMap();
  return (
    <button type="button" className={className} onClick={() => show(handle)}>
      Show on map
    </button>
  );
}
