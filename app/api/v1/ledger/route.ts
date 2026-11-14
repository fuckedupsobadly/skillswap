import { getDb } from "@/db/client";
import { ledgerPage } from "@/modules/ledger/service";

/** Public, paged ledger for the audit page and anyone verifying with their own code. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const after = Math.max(0, Number(url.searchParams.get("after") ?? 0) || 0);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 500) || 500));
  const entries = await ledgerPage(await getDb(), after, limit);
  return Response.json(
    { entries, next: entries.length === limit ? entries[entries.length - 1].seq : null },
    { headers: { "Cache-Control": "public, max-age=5" } },
  );
}
