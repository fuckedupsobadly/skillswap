import Place from "@/app/(plain)/guild/[id]/page";
import { Sheet } from "@/ui/sheet";

export { generateMetadata } from "@/app/(plain)/guild/[id]/page";

/** Guild hall as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted(props: Parameters<typeof Place>[0]) {
  return (
    <Sheet label="Guild hall">
      <Place {...props} />
    </Sheet>
  );
}
