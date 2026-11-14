import { KittyRoot } from "@/ui/kitty/root";
import { PlainHeader } from "@/ui/plain-header";
import { getViewer } from "../_lib/viewer";

/** Plain mode (§9): standard pages with the same features as the village places, semantic HTML, no walking. */
export default async function PlainLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <>
      <PlainHeader />
      <main id="main">{children}</main>
      {viewer ? <KittyRoot mode="page" /> : null}
    </>
  );
}
