# Agentic Coding with Unity guide

Route: `/guides/agentic-coding-with-unity`. Reviewed October 25, 2026.
The former `/guides/ai-with-unity` route permanently redirects here.

## Scope and copy

The guide explains coding agents working with Unity CLI and the Pipeline
package. Five cards cover CI/CD, gameplay testing, deployment, asset validation,
and performance. Runtime model inference is outside the guide's scope.

Keep one main heading and a short definition of agentic coding. The overview
explains CLI versus Pipeline and separates agent-authored work from saved scripts
that run without an agent. A four-step infographic shows describe, change, check,
and review. Setup and detailed workflows use native HTML disclosures.

Prompts are examples to adapt, not executed case studies. Keep the platform,
project paths, tests, and success criteria specific. Do not assume a bug exists
or claim passing tests prove all behavior correct. Parallel Unity jobs need
separate project copies; performance comparisons need matching environments.

## Official sources

- https://docs.unity.com/en-us/unity-cli/use-unity-cli
- https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package
- https://unity.com/resources/unity-pipeline-cli-technical-walkthrough
- https://docs.unity.com/en-us/engine/6000.3/manual/programming-environment/test-framework-introduction/running-tests/run-tests-from-command-line
- https://docs.unity.com/en-us/build-automation/build-automation-glossary
- https://unity.com/blog/engine-platform/performance-benchmarking-in-unity-how-to-get-started

## Mecha Drive evidence

The introduction links https://mechadrive.games and describes it as a vibe-coded
Unity game used to check workflows. Each card distinguishes recorded results
from suggested additions. The source/evidence review below did not rerun the
Unity project or deploy it. Historical receipts apply to their recorded revision
and platform, not today's working tree.

Paths are relative to ArmoredDrive/armored-drive.

| Card | Files inspected in ArmoredDrive/armored-drive | What they establish |
| --- | --- | --- |
| CI/CD | `package.json` (`validate`, `validate:release`, `check:content-admission`, `check:web-demo`) | Scripted checks exist. No running PR CI service, nightly schedule, or cache strategy was established. |
| Game testing | `unity/Assets/ArmoredDrive/Tests/EditMode/RecordedDriveTests.cs`; `docs/design/music-web-delivery-2026-10-17/README.md` and `browser-live.json` | Recorded-drive regression tests and historical live finish/pause/retry/reload checks. The inventory/death example is an adaptation. |
| Deployment | `tools/web/release.mjs`; the October 17 delivery README | Package verification before deployment commits; saved successful deployment and live browser evidence. Automatic preview promotion and rollback drills are suggestions. |
| Assets | `tools/content/texture-compression.test.mjs`; the October 17 delivery README | Source hashes, GUID preservation, compression receipts, and 2,273 imported art texture checks. Generic missing-script scanning is an extension. |
| Performance | `docs/design/interstate-full-route-2026-10-25.json`; `docs/levels/interstate-completion-2026-10-22.md` | Matched images, recordings, and Editor timings. The slower Ironwater draw-range approach was rejected. The receipt explicitly leaves phone timing, heat, and memory unverified. |

## Presentation and performance

Reuse the site's guide-grid, guide-card, guide-feature-image,
guide-highlight-copy, and guide-badge classes. The local official release images
are contextual illustrations, not proof that the prompts ran. Source URLs live
in src/lib/release-guide-images.json and captions link the announcements.
Image keys: 6.6-2, 6.0-7, 6.0-3, 6.5-1, and 6.3-1.

The diagram uses semantic HTML and existing SVG icons. It stacks on mobile and
adds no image download or client JavaScript. Lower card images load lazily.
The page adds no database call or video. Shared layout costs still apply.

## Verification

The focused browser test checks the old-URL redirect, discovery links, sidebar,
canonical URL, five expandable cards, keyboard use, image loading, Mecha Drive
link, four-step infographic, 320px overflow, and light/dark accessibility.
Run typecheck and the sitemap test when changing routes. Verify the sidebar's
long title remains readable. The overview and closed cards stay under 700 words.
