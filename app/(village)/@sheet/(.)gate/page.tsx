import Place from "@/app/(plain)/gate/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/gate/page";

/** The Gate as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="The Gate">
      <Place />
    </Sheet>
  );
}
