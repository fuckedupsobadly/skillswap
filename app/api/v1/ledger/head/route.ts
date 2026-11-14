import { getDb } from "@/db/client";
import { ledgerHead } from "@/modules/ledger/service";

export async function GET() {
  return Response.json(await ledgerHead(await getDb()), { headers: { "Cache-Control": "no-store" } });
}
