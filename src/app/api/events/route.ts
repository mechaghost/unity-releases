import { jsonError } from "@/lib/api";
import { listFeedEvents } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ events: await listFeedEvents() });
  } catch (error) {
    return Response.json(jsonError(error), { status: 500 });
  }
}
