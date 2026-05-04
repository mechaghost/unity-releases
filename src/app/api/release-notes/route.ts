import { filtersFromSearchParams, jsonError } from "@/lib/api";
import { searchReleaseNotes } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const filters = filtersFromSearchParams(new URL(request.url).searchParams);
    const results = await searchReleaseNotes(filters);
    return Response.json({ results });
  } catch (error) {
    return Response.json(jsonError(error), { status: 500 });
  }
}
