import { expect, test } from "vitest";
import { parseUnityBlogRss } from "../../src/lib/parsers/rss";
const parse = (item:string) => parseUnityBlogRss(`<rss><channel><item>${item}</item></channel></rss>`,"https://unity.com/blog/rss");
test.each([
  "<error>unavailable</error>",
  "<title> </title><link>https://unity.com/blog/example</link>",
  "<title>Title</title><guid>id</guid>",
  "<title>Title</title><link>javascript:alert(1)</link>",
  "<title>Title</title><link>/blog/example</link>",
  "<title>Title</title><link>https://unity.com/blog/example</link><pubDate>invalid</pubDate>"
])("rejects malformed feed records: %s",(item)=>{expect(()=>parse(item)).toThrow();});
test("missing optional date uses epoch and missing guid uses the valid article URL",()=>{
  expect(parse("<title>Title</title><link>https://unity.com/blog/example</link>")[0]).toMatchObject({
    title:"Title",guid:"https://unity.com/blog/example",publishedAt:"1970-01-01T00:00:00.000Z"
  });
});
