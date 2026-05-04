import { jsonError } from "@/lib/api";
import { listReleases } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ releases: await listReleases() });
  } catch (error) {
    return Response.json(jsonError(error), { status: 500 });
  }
}
