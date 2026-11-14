import { getDb } from "@/db/client";
import { relay } from "@/jobs/relay";
import { nightly, sweep } from "@/jobs/sweep";

/**
 * Vercel Cron fallback for deployments without Inngest. Protected by CRON_SECRET (sent as a bearer token).
 * ?nightly=1 also runs whole-graph matching and ledger reconciliation.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("unauthorized", { status: 401 });
  const db = await getDb();
  const url = new URL(req.url);
  const result = {
    sweep: await sweep(db),
    relayed: await relay(db),
    nightly: url.searchParams.get("nightly") ? await nightly(db) : null,
  };
  return Response.json(result);
}
