import Place from "@/app/(plain)/hall/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/hall/page";

/** Town Hall as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Town Hall">
      <Place />
    </Sheet>
  );
}
