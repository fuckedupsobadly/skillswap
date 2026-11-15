"use client";
import { createContext, useContext } from "react";
import { PixelIcon } from "./pixel/icons";

/** Set by <Sheet>: lets a page know it is open over the world, and how to close itself. */
export const SheetContext = createContext<{ close: () => void } | null>(null);

/** A visible way out of every sheet (Esc and a click on the world work too). Nothing on a plain page. */
export function SheetClose() {
  const sheet = useContext(SheetContext);
  if (!sheet) return null;
  return (
    <button
      type="button"
      onClick={sheet.close}
      aria-label="Close (Esc)"
      title="Close · Esc"
      className="btn btn-secondary absolute top-3 right-3 z-10 size-11 p-0"
    >
      <PixelIcon name="close" size={16} />
    </button>
  );
}
