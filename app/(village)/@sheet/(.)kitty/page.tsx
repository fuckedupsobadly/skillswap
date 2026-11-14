import Place from "@/app/(plain)/kitty/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/kitty/page";

/** Your kitty as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Your kitty">
      <Place />
    </Sheet>
  );
}
