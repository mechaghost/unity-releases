import { fetchText } from "../lib/ingest/fetch";
import { parseUnityBlogRss } from "../lib/parsers/rss";

async function main() {
  const fetched = await fetchText("https://unity.com/blog/rss");
  const posts = parseUnityBlogRss(fetched.text, fetched.finalUrl);
  console.log(JSON.stringify({ posts: posts.length, latest: posts[0]?.title ?? null }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
