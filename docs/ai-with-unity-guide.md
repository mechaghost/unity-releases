# AI with Unity guide

Route: `/guides/ai-with-unity`. Reviewed October 25, 2026.

Six illustrated cards cover CI/CD, gameplay tests, deployment, asset validation,
performance checks, and Sentis pose controls. The overview stays short. Native
HTML disclosures contain prerequisites, three workflow steps, a substantial
prompt, acceptance checks, and official reading. Setup is another disclosure.

The prompts are original project scenarios, not completed case studies or
ready-to-run samples. They distinguish agent-authored automation from the CI
runner that executes it. No Unity project or actual deployment pipeline was
created or tested for this article. Muse and MCP are excluded at user request.

## Sources

The site's Resources index supplied the Unity CLI beginner article and Pipeline
technical walkthrough. The package catalog and GitHub index supplied Sentis.
Official docs govern setup; versioned Sentis examples must match the installed
package. The guide links each workflow's relevant source directly.

- https://docs.unity.com/en-us/unity-cli/use-unity-cli
- https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package
- https://unity.com/resources/a-beginners-guide-to-unity-cli-and-the-pipeline-package
- https://unity.com/resources/unity-pipeline-cli-technical-walkthrough
- https://docs.unity.com/en-us/engine/6000.3/manual/programming-environment/test-framework-introduction/running-tests/run-tests-from-command-line
- https://docs.unity.com/en-us/build-automation/build-automation-glossary
- https://unity.com/blog/engine-platform/performance-benchmarking-in-unity-how-to-get-started
- https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/get-started.html
- https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/understand-sentis-workflow.html
- https://github.com/Unity-Technologies/sentis-samples

Sentis 2.6 uses `com.unity.ai.inference` and `Unity.InferenceEngine`. The official
sample catalog includes Blaze face/hand/pose detection. The proposed control
mapping, smoothing, and fallback are application work described by this guide.

## Images and performance

All six images reuse optimized local WebP files from the release guides. The
manifest `src/lib/release-guide-images.json` records their original URLs. Each
card links the release announcement. Images retain the full frame, with alt text
and fixed dimensions. The page explains that these illustrate Unity features,
not results of the example prompts. Lower images load lazily.

Image keys: 6.6-2 (Build Analysis), 6.0-7 (UI Builder), 6.0-3 (Build Profiles),
6.5-1 (2D Profiler), 6.3-1 (Profiler), 6.0-5 (Sentis).

The page adds no client component, database call, remote image, or video. Shared
layout costs still apply. Content lives in `src/lib/ai-guide-examples.ts`.

## Verification

`tests/e2e/ai-guide.spec.ts` checks discovery, navigation, canonical URL, all six
cards, keyboard disclosure controls, workflow steps, prompts, setup, local image
loading, and internal destinations. It checks overflow at 320px and accessibility
in light/dark themes with cards closed and open, and saves screenshots. The
collapsed overview stays below 700 words; detailed workflows have no artificial
word cap. Run typecheck and the focused production-build browser tests.

## Mecha Drive cross-check — October 25, 2026

Read the current ArmoredDrive/armored-drive source and saved receipts. This was
a source/evidence review, not a fresh Unity run or deployment. No Mecha Drive
files were changed. Historical receipts certify their captured revision and
platform, not today's working tree. Each card now states its evidence and limits.

| Card | Files inspected in ArmoredDrive/armored-drive | What they establish |
| --- | --- | --- |
| CI/CD | `package.json` (`validate`, `validate:release`, `check:content-admission`, `check:web-demo`) | Scripted checks exist. No running PR CI service, nightly schedule, or cache strategy was established. |
| Game testing | `unity/Assets/ArmoredDrive/Tests/EditMode/RecordedDriveTests.cs`; `docs/design/music-web-delivery-2026-10-17/README.md` and `browser-live.json` | Recorded-drive regression tests and historical live finish/pause/retry/reload checks. The inventory/death example is an adaptation. |
| Deployment | `tools/web/release.mjs`; the October 17 delivery README | Package verification before deployment commits; saved successful deployment and live browser evidence. Automatic preview promotion and rollback drills are suggestions. |
| Assets | `tools/content/texture-compression.test.mjs`; the October 17 delivery README | Source hashes, GUID preservation, compression receipts, and 2,273 imported art texture checks. Generic missing-script scanning is an extension. |
| Performance | `docs/design/interstate-full-route-2026-10-25.json`; `docs/levels/interstate-completion-2026-10-22.md` | Matched images, recordings, and Editor timings. The slower Ironwater draw-range approach was rejected. The receipt explicitly leaves phone timing, heat, and memory unverified. |
| Sentis | Unity's official sample catalog and package docs | Official starting point only; no Mecha Drive implementation or runtime result. |

The visible overview distinguishes standalone CLI, the in-project Pipeline
package, and hosted CI. Setup links were rechecked against official documentation.
Cards reuse the site's `guide-grid`, `guide-card`, `guide-feature-image`,
`guide-highlight-copy`, and `guide-badge` classes for the same surfaces, image
frames, spacing, and responsive behavior as the release cards. The overview
and closed cards together stay under 700 words.

## Four-perspective editorial review — October 25, 2026

Reviewed for technical writing, AI claims, Unity accuracy, and reader usefulness.
Shortened card titles and removed the claim that tests prove a project works.
Explained the agent's role once: creating and debugging automation, with saved
scripts running without AI on every invocation. Added prompt-adaptation and
result-reporting guidance plus the missing project-folder handoff after setup.

Technical corrections: CI prompts use complete Unity configuration paths and
the reader's target platform; parallel Unity jobs get separate checkouts; import
cache keys include runner OS. Gameplay prompts investigate repeated damage in
a physics step without assuming a bug exists. Performance comparisons specify
build settings, resolution, quality, frame cap, device, and graphics API. Sentis
preprocessing now includes pixel scaling. Retained sample/version compatibility
and the explicit lack of Mecha Drive Sentis validation.

Evidence notes are shorter and labeled 'Evidence and limits'. Historical dates
and Editor/device boundaries remain. Official release images remain contextual
illustrations, not screenshots of the proposed test jobs or executed prompts.
