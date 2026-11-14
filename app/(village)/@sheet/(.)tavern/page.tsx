import Place from "@/app/(plain)/tavern/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/tavern/page";

/** The Swapped Mug as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="The Swapped Mug">
      <Place />
    </Sheet>
  );
}
