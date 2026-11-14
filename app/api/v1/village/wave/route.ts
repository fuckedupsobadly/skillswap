import { hub } from "@/modules/village/hub";
import { getViewer } from "../../../../_lib/viewer";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });
  hub.wave(viewer.memberId);
  return new Response(null, { status: 204 });
}
