import { fetchText } from "../lib/ingest/fetch";
import { recordSourceSnapshot, upsertBlogPosts, withIngestionTransaction } from "../lib/db/repositories";
import { parseUnityBlogRss } from "../lib/parsers/rss";

async function main() {
  await withIngestionTransaction("blog_rss", "poll-news", async (client, runId) => {
    const fetched = await fetchText("https://unity.com/blog/rss");
    const sourceSnapshotId = await recordSourceSnapshot(client, "blog_rss", fetched);
    const posts = parseUnityBlogRss(fetched.text, fetched.finalUrl);
    await upsertBlogPosts(client, posts, sourceSnapshotId, runId);
    console.log(JSON.stringify({ posts: posts.length, latest: posts[0]?.title ?? null }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
