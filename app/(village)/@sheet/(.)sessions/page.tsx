import Place from "@/app/(plain)/sessions/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/sessions/page";

/** Lantern Rooms as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Lantern Rooms">
      <Place />
    </Sheet>
  );
}
