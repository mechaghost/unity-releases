# AI with Unity guide

Route: `/guides/ai-with-unity`. Reviewed October 25, 2026.

The guide helps a developer connect a coding agent to an existing Unity project,
make one small change, and verify it. A separate path covers Sentis runtime
inference. Muse and MCP are intentionally excluded at the user's request.

## Sources and scope

The local Resources index supplied the September 17, 2026 Unity CLI beginner
article and the August 13, 2026 Pipeline technical walkthrough. Both were read.
The newer official CLI and Pipeline docs govern setup, rather than installation
commands or version claims in the older articles. The indexed package catalog
includes `com.unity.ai.inference`, and the GitHub index includes Sentis samples.

Official pages read for this revision:

- https://docs.unity.com/en-us/unity-cli/use-unity-cli
- https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package
- https://unity.com/resources/a-beginners-guide-to-unity-cli-and-the-pipeline-package
- https://unity.com/resources/unity-pipeline-cli-technical-walkthrough
- https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.7/manual/install/install-chat.html
- https://docs.unity.com/en-us/ai/unity-dashboard/ai-settings
- https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/index.html
- https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/get-started.html
- https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/understand-sentis-workflow.html

The rotating-cube prompt is an original editorial recommendation. They are
not a downloadable sample or evidence of a Unity playtest. Setup and API guidance
were checked against the sources; no Unity project was created or modified.

## Maintenance

Keep this as reviewed content, not a live aggregation of search results. Check
versioned package docs and CLI setup before changing the review date. Sentis 2.6
uses `com.unity.ai.inference` and `Unity.InferenceEngine`; do not silently mix
older API examples into this guide. Avoid fixed pricing and unverified speed
claims. Links sit beside relevant guidance and in a short reading list.

The page reuses shared navigation, the FAQ contents links, fonts, tokens, and
ExternalLink. Its CSS module adds only article layout. It has no page-specific
client code, database calls, remote images, or embedded video. Shared-layout costs
still apply. Discovery links live in navigation, Resources, FAQ, sitemap, and
llms.txt.

## Verification

`tests/e2e/ai-guide.spec.ts` checks discovery, active navigation, canonical URL,
section links, internal destinations, keyboard access, 320px overflow, and light
and dark accessibility. The sitemap unit test includes the new route. Use the
existing full unit suite and typecheck alongside the production browser build.

## Editorial pass — October 25, 2026

Replaced the long pickup exercise with three short steps and a rotating-cube
prompt. Kept Sentis as a separate path. Removed the long prompt collection,
troubleshooting list, and repeated source descriptions. Package details now sit
in a native disclosure. Browser checks cap the guide at 650 words.

Two official Unity images introduce the paths. The cube is a still from Unity's
CLI tutorial (not a capture of our example); its original is:
https://cdn.sanity.io/images/fuvbjjlp/production/67fba7edc3bfc24878c3a25c5eeb940fcd06f17d-640x414.gif
Source article: https://unity.com/resources/a-beginners-guide-to-unity-cli-and-the-pipeline-package
Local optimized copy: public/images/ai-guide/rotating-cube.webp (640 × 414).

The Sentis image reuses public/images/release-guides/6.0-5.webp from the Unity 6
release announcement. Its original URL is recorded in src/lib/release-guide-images.json.
Both images retain their full frame, have descriptive alt text, and link their
source in a caption. No generated artwork or remote image requests are added.
