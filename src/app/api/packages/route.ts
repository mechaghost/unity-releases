import { jsonError } from "@/lib/api";
import { listPackages } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ packages: await listPackages() });
  } catch (error) {
    return Response.json(jsonError(error), { status: 500 });
  }
}
