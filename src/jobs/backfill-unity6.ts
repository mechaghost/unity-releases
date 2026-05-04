import { fetchText } from "../lib/ingest/fetch";

async function main() {
  const archive = await fetchText("https://unity.com/releases/editor/archive");
  const versions = [...archive.text.matchAll(/\b6\d{3}\.\d+\.\d+[abfp]\d+\b/g)]
    .map((match) => match[0])
    .filter((value, index, all) => all.indexOf(value) === index);

  console.log(JSON.stringify({ discoveredUnity6Versions: versions }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
