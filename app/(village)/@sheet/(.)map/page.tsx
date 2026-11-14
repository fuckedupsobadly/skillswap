import Place from "@/app/(plain)/map/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/map/page";

/** The village as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="The village">
      <Place />
    </Sheet>
  );
}
