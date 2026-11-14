import Place from "@/app/(plain)/pond/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/pond/page";

/** Community Pond as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Community Pond">
      <Place />
    </Sheet>
  );
}
