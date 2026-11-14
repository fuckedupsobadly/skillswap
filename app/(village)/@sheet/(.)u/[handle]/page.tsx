import Place from "@/app/(plain)/u/[handle]/page";
import { Sheet } from "@/ui/sheet";

export { generateMetadata } from "@/app/(plain)/u/[handle]/page";

/** Member as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted(props: Parameters<typeof Place>[0]) {
  return (
    <Sheet label="Member">
      <Place {...props} />
    </Sheet>
  );
}
