import Place from "@/app/(plain)/gate/villager/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/gate/villager/page";

/** Make your villager as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Make your villager">
      <Place />
    </Sheet>
  );
}
