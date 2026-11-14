import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know our type scale (globals.css: --text-13 … --text-32) is font sizes. Otherwise it
 * reads `text-17` as a colour and drops a real colour such as `text-accent-fg` from the same element.
 */
const twMerge = extendTailwindMerge({ extend: { theme: { text: ["13", "15", "17", "22", "32"] } } });

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
