import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const out = new URLSearchParams();
  if (typeof params.from === "string" && params.from) out.set("from", params.from);
  if (typeof params.to === "string" && params.to) out.set("to", params.to);
  if (typeof params.platform === "string" && params.platform) out.set("platform", params.platform);
  redirect(`/compare${out.toString() ? `?${out.toString()}` : ""}`);
}
