import { jsonError } from "@/lib/api";
import { listFeedEvents } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope");
    if (scope && scope !== "core" && scope !== "product-updates") {
      return Response.json({ error: "invalid_scope" }, { status: 400 });
    }
    if (scope === "product-updates") {
      if (process.env.PRODUCT_UPDATE_UI_ENABLED !== "true") {
        return Response.json(
          { error: "product_updates_disabled" },
          { status: 404 }
        );
      }
      return Response.json({
        events: await listFeedEvents(50, { productUpdates: "only" })
      });
    }
    return Response.json({
      events: await listFeedEvents(50, { productUpdates: "exclude" })
    });
  } catch (error) {
    return Response.json(jsonError(error), { status: 500 });
  }
}
