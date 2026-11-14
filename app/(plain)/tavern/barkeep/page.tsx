import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/app/_lib/viewer";
import { aiEnabled } from "@/modules/ai/concierge";
import { Page } from "@/ui/bits";
import { ConciergeChat } from "./chat";

export const metadata = { title: "Barkeep · AI" };

/** The Barkeep: the AI concierge. His nameplate always says "AI"; he drafts, and never books or moves hours. */
export default async function Barkeep() {
  if (!(await getViewer())) redirect("/gate");
  return (
    <Page
      title="Barkeep · AI"
      sub="An AI, not a member. He reads wishes, explains matches and drafts requests; nothing happens until you approve it."
    >
      {aiEnabled() ? (
        <ConciergeChat />
      ) : (
        <div className="grid justify-items-start gap-3">
          <p>
            The Barkeep's AI isn't set up on this server (no AI Gateway key), so he can only read wishes with
            simple rules.
          </p>
          <Link href="/well" className="btn btn-secondary">
            Make a wish
          </Link>
        </div>
      )}
    </Page>
  );
}
