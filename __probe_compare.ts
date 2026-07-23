import { buildCompareMarkdownExport } from "@/lib/compare-export";

async function run(qs: string) {
  try {
    const r = await buildCompareMarkdownExport(new URLSearchParams(qs));
    console.log(qs, "=>", r.ok ? `ok ${r.markdown.length} chars` : `${r.error}`);
  } catch (e) {
    console.log(qs, "=> THREW:", e instanceof Error ? e.stack?.split("\n").slice(0, 6).join("\n") : String(e));
  }
}

async function main() {
  for (const qs of process.argv.slice(2)) {
    await run(qs);
  }
  process.exit(0);
}

main();
