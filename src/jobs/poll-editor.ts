import { fetchText } from "../lib/ingest/fetch";
import { extractReleasePageMetadata } from "../lib/parsers/release-page";

const EDITOR_SOURCES = [
  "https://unity.com/releases/editor/latest",
  "https://unity.com/releases/editor/beta",
  "https://unity.com/releases/editor/alpha"
];

async function main() {
  for (const url of EDITOR_SOURCES) {
    const fetched = await fetchText(url);
    const metadata = extractReleasePageMetadata(fetched.text, fetched.finalUrl);
    console.log(JSON.stringify({ source: url, finalUrl: fetched.finalUrl, version: metadata.version }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
