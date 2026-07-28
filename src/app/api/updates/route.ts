import { z } from "zod";
import {
  listProductUpdates,
  productUpdatesSchemaReady
} from "@/lib/product-updates/repositories";
import { PRODUCT_UPDATE_FAMILIES } from "@/lib/product-updates/types";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  family: z.enum(PRODUCT_UPDATE_FAMILIES).optional(),
  product: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120).optional(),
  kind: z.string().min(1).max(80).optional(),
  platform: z.string().min(1).max(80).optional(),
  version: z.string().min(1).max(120).optional(),
  channel: z.string().min(1).max(80).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(500).optional()
});

export async function GET(request: Request) {
  if (process.env.PRODUCT_UPDATE_UI_ENABLED !== "true") {
    return Response.json({ error: "product_updates_disabled" }, { status: 404 });
  }
  if (!(await productUpdatesSchemaReady())) {
    return Response.json(
      { configured: false, error: "product_updates_not_configured" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  let before: { sortTime: string; id: number } | null = null;
  if (parsed.data.cursor) {
    try {
      const cursor = JSON.parse(
        Buffer.from(parsed.data.cursor, "base64url").toString("utf8")
      ) as unknown;
      const cursorResult = z
        .object({ sortTime: z.string().datetime({ offset: true }), id: z.number().int().positive() })
        .safeParse(cursor);
      if (!cursorResult.success) throw new Error("invalid cursor");
      before = cursorResult.data;
    } catch {
      return Response.json({ error: "invalid_cursor" }, { status: 400 });
    }
  }

  const updates = await listProductUpdates({
    family: parsed.data.family,
    product: parsed.data.product,
    changeKind: parsed.data.kind,
    platform: parsed.data.platform,
    version: parsed.data.version,
    channel: parsed.data.channel,
    from: parsed.data.from,
    to: parsed.data.to,
    limit: parsed.data.limit,
    before
  });
  const last = updates.at(-1);
  const nextCursor =
    updates.length === parsed.data.limit && last
      ? Buffer.from(
          JSON.stringify({ sortTime: last.sortTime, id: last.id }),
          "utf8"
        ).toString("base64url")
      : null;

  return Response.json({
    configured: true,
    updates,
    nextCursor
  });
}
