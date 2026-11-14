import Place from "@/app/(plain)/tower/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/tower/page";

/** Clock Tower as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Clock Tower">
      <Place />
    </Sheet>
  );
}
