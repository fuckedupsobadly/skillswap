import { createAgentUIStreamResponse } from "ai";
import { getDb } from "@/db/client";
import { aiEnabled, conciergeAgent } from "@/modules/ai/concierge";
import { DomainError } from "@/modules/platform/errors";
import { rateLimit } from "@/modules/platform/rate-limit";
import { getViewer } from "../../../../_lib/viewer";

/** Streaming concierge chat. Read and draft tools only; anything that acts needs the member's own tap. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "No guest identity yet. Reload the page." }, { status: 401 });
  if (!aiEnabled())
    return Response.json({ error: "The AI concierge isn't configured on this deployment." }, { status: 503 });
  try {
    await rateLimit(`ai-chat:${viewer.memberId}`, { max: 10, windowS: 60 });
  } catch (e) {
    if (e instanceof DomainError) return Response.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const { messages } = (await req.json()) as { messages: unknown[] };
  return createAgentUIStreamResponse({
    agent: conciergeAgent(await getDb(), viewer.memberId),
    uiMessages: (messages ?? []).slice(-20),
  });
}
