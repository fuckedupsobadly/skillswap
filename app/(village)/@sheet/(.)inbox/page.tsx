import Place from "@/app/(plain)/inbox/page";
import { Sheet } from "@/ui/sheet";

export { metadata } from "@/app/(plain)/inbox/page";

/** Mailbox as a parchment sheet over the world (§8); a direct visit gets the plain twin page. */
export default function Intercepted(props: Parameters<typeof Place>[0]) {
  return (
    <Sheet label="Mailbox">
      <Place {...props} />
    </Sheet>
  );
}
