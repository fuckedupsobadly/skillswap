import { getDb } from "@/db/client";
import { allSkills, listCategories } from "@/modules/catalog/service";

/** Public skill taxonomy. */
export async function GET() {
  const db = await getDb();
  const [categories, skills] = await Promise.all([listCategories(db), allSkills(db)]);
  return Response.json({ categories, skills }, { headers: { "Cache-Control": "public, max-age=300" } });
}
