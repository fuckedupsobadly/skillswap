import Place from "@/app/(plain)/bank/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/bank/page";

/** Hourglass Bank as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Hourglass Bank">
      <Place />
    </Sheet>
  );
}
