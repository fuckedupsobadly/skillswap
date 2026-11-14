import Place from "@/app/(plain)/hut/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/hut/page";

/** Your hut as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted() {
  return (
    <Sheet label="Your hut">
      <Place />
    </Sheet>
  );
}
