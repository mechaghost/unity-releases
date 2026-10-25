import { pathToFileURL } from "node:url";
import { scheduledJobMain } from "../lib/ingest/job-health";
import { fetchText } from "../lib/ingest/fetch";
import { recordSourceSnapshot, upsertBlogPosts, withIngestionTransaction } from "../lib/db/repositories";
import { parseUnityBlogRss } from "../lib/parsers/rss";

export async function main() {
  await withIngestionTransaction("blog_rss", "poll-news", async (client, runId) => {
    const fetched = await fetchText("https://unity.com/blog/rss");
    if (fetched.status !== 200) throw new Error(`News HTTP ${fetched.status}`);
    const sourceSnapshotId = await recordSourceSnapshot(client, "blog_rss", fetched);
    const posts = parseUnityBlogRss(fetched.text, fetched.finalUrl);
    await upsertBlogPosts(client, posts, sourceSnapshotId, runId);
    console.log(JSON.stringify({ posts: posts.length, latest: posts[0]?.title ?? null }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void scheduledJobMain("poll-news", main);
}
