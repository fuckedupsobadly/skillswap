import Place from "@/app/(plain)/gate/kitty/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/gate/kitty/page";

/** Pick your kitten as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Pick your kitten">
      <Place />
    </Sheet>
  );
}
