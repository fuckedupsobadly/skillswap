import Place from "@/app/(plain)/market/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/market/page";

/** Market Row as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Market Row">
      <Place />
    </Sheet>
  );
}
