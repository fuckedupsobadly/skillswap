import Place from "@/app/(plain)/tavern/barkeep/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/tavern/barkeep/page";

/** Barkeep · AI as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Barkeep · AI">
      <Place />
    </Sheet>
  );
}
