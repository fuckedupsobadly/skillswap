import { expect, it } from "vitest";
import { cn } from "@/ui/cn";

// Regression: our type scale (text-13…text-32) was read as a text colour, so cn() dropped real colours
// like text-accent-fg — white button labels rendered dark.
it("keeps a text colour next to a custom text size", () => {
  expect(cn("text-accent-fg", "text-17")).toBe("text-accent-fg text-17");
  expect(cn("text-danger text-13", "text-15")).toBe("text-danger text-15");
  expect(cn("text-fg", "text-muted")).toBe("text-muted");
});
