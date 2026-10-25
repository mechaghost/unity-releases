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
collapsed overview stays below 500 words; detailed workflows have no artificial
word cap. Run typecheck and the focused production-build browser tests.
