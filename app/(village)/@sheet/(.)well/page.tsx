import Place from "@/app/(plain)/well/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/well/page";

/** Wishing Well as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted(props: Parameters<typeof Place>[0]) {
  return (
    <Sheet label="Wishing Well">
      <Place {...props} />
    </Sheet>
  );
}
