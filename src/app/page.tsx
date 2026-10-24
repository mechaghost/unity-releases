import { redirect } from "next/navigation";
import { legacyCompareHref } from "@/lib/home-navigation";
import WhatsNewPage from "./whats-new/page";
export { dynamic, metadata } from "./whats-new/page";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const legacy = legacyCompareHref(await searchParams);
  if (legacy) redirect(legacy);
  return <WhatsNewPage />;
}
