import type { ReactNode } from "react";
import { ExternalLink } from "../../_components/ExternalLink";
import { pageSocialMetadata } from "@/lib/site";
import { productUpdateNavigationEnabled } from "@/lib/product-updates/flags";
import styles from "./page.module.css";

const title = "How to use AI with Unity";
const description = "Connect an AI coding agent to Unity, build and verify a small feature, or run a trained model in your game with Sentis.";
export const metadata = {
  title, description,
  alternates: { canonical: "/guides/ai-with-unity" },
  ...pageSocialMetadata({ title, description, path: "/guides/ai-with-unity" })
};

const sources = {
  cli: { title: "Install Unity CLI", url: "https://docs.unity.com/en-us/unity-cli/use-unity-cli", detail: "Current installation options and supported operating systems." },
  pipeline: { title: "Connect the Pipeline package", url: "https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package", detail: "Connect a running Editor and select the right project." },
  beginner: { title: "Unity’s CLI beginner tutorial", url: "https://unity.com/resources/a-beginners-guide-to-unity-cli-and-the-pipeline-package", detail: "A longer walkthrough from the Resources index. Use the current install docs above for setup." },
  assistant: { title: "Install the in-Editor Assistant", url: "https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.7/manual/install/install-chat.html", detail: "An alternative if you prefer working in an Editor panel. These instructions are for Assistant 2.7." },
  settings: { title: "Unity AI organization settings", url: "https://docs.unity.com/en-us/ai/unity-dashboard/ai-settings", detail: "Access and data-sharing controls for Unity’s own AI tools." },
  sentis: { title: "Sentis 2.6 overview", url: "https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/index.html", detail: "Runtime inference and the current package naming." },
  workflow: { title: "Sentis model workflow", url: "https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/understand-sentis-workflow.html", detail: "Load a model, prepare inputs, schedule work, and read outputs." },
  samples: { title: "Sentis starter samples", url: "https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/get-started.html", detail: "Start with a supplied example before bringing your own model." }
};
const sections = [
  ["choose", "Choose your path"], ["setup", "Connect the Editor"],
  ["first-feature", "Build a small feature"], ["prompts", "Useful prompts"],
  ["sentis", "Run a model with Sentis"], ["troubleshooting", "When things go wrong"],
  ["resources", "Keep learning"]
];
function Source({ id }: { id: keyof typeof sources }) {
  return <ExternalLink href={sources[id].url}>{sources[id].title}</ExternalLink>;
}
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className={styles.section} aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>{title}</h2>{children}
  </section>;
}
function Prompt({ children }: { children: string }) {
  return <pre className={styles.prompt}><code>{children}</code></pre>;
}

export default function AiWithUnityPage() {
  return <article className={styles.guide}>
    <header className="page-header">
      <p className={styles.eyebrow}>Practical guide · Reviewed October 25, 2026</p>
      <h1>{title}</h1>
      <p>Start with one small task. Give the agent the right project context, let it make a focused change, then check the result in Unity.</p>
      <p className={styles.note}>For developers who can open a Unity project and use the Inspector. This is an independent guide based on Unity’s docs and resources; the example prompts are ours.</p>
    </header>
    <nav className="faq-toc" aria-label="On this page">
      {sections.map(([id, label]) => <a className="faq-toc__link" key={id} href={`#${id}`}>{label}</a>)}
    </nav>

    <Section id="choose" title="1. Choose your path">
      <div className={styles.paths}>
        <div><h3>Build with AI</h3><p>Use an agent to inspect scenes, edit scripts, wire components, and check a feature. The Unity CLI and Pipeline package connect your terminal agent to the running Editor.</p><a href="#setup">Set up the development workflow →</a></div>
        <div><h3>Put AI in your game</h3><p>Use Sentis to run a trained neural network on the player’s device. It takes model inputs and produces outputs your game can use. It is a different job from generating code.</p><a href="#sentis">Start with Sentis →</a></div>
      </div>
      <p className={styles.note}>Pick the tool for the job: <Source id="pipeline" /> · <Source id="sentis" />.</p>
    </Section>

    <Section id="setup" title="2. Connect the Editor">
      <p>Use Unity 6.0 or later for the Pipeline package. Keep your project’s existing Editor version unless the package’s compatibility requirements require a change. Save your work and make a version-control checkpoint first.</p>
      <ol>
        <li><strong>Install the CLI.</strong> Follow <Source id="cli" /> for your operating system, then reopen your terminal. Check the installed version with <code>unity --version</code>.</li>
        <li><strong>Open the project.</strong> Start it in Unity and open a terminal in its project folder, alongside <code>Assets</code>, <code>Packages</code>, and <code>ProjectSettings</code>.</li>
        <li><strong>Install Pipeline.</strong> Run the first two commands below, then wait for Unity to finish compiling. The installation changes the project’s packages.</li>
        <li><strong>Check the connection.</strong> Run the last two commands. Confirm <strong>Pipeline: Installed</strong> and check the reported project before letting an agent edit it.</li>
      </ol>
      <Prompt>{`unity auth login
unity pipeline install
unity pipeline list
unity command`}</Prompt>
      <p>With several Editors open, select one explicitly:</p>
      <Prompt>{`unity command --project-path="/path/to/your/project"`}</Prompt>
      <p>Open your terminal-capable coding agent in that same project folder. Start with an inspection request:</p>
      <Prompt>{`Inspect this Unity project without changing it. Report the Editor version,
render pipeline, input system, active scene, and current Console errors.
Use unity command to discover the available Editor commands.
Confirm the project path before taking any action.`}</Prompt>
      <p>Keep the local Editor connection separate from the agent’s model service: a local CLI does not mean the agent runs offline. Choose what project context you send through your provider.</p>
      <p className={styles.note}>Connection instructions: <Source id="pipeline" />. Prefer an Editor panel? <Source id="assistant" /> and check <Source id="settings" />. Match the documentation to the package version you install.</p>
    </Section>

    <Section id="first-feature" title="3. Build a collectible pickup">
      <p>This exercise keeps the result small enough to inspect. Use a disposable 3D scene and your project’s existing movement controls; the task is the pickup, not a new player controller.</p>
      <ol>
        <li><strong>Define the behavior.</strong> A player touches a pickup, the score increases once, and that pickup disappears.</li>
        <li><strong>Ask for a plan.</strong> Have the agent identify the player object, score display, and collider setup. Check those choices before it edits.</li>
        <li><strong>Build one piece.</strong> Let it add the pickup and connect it to the existing score UI. Review the scripts and Inspector references.</li>
        <li><strong>Play it.</strong> Touch the pickup, stay in the trigger area, then restart the scene. Check the score and Console each time.</li>
      </ol>
      <Prompt>{`In a new test scene, add one collectible pickup using this project's
existing player and score UI. First explain the collision setup and list
the files and objects you will change. Do not replace the input system,
render pipeline, or existing player controller.

After I approve the plan, implement it. The score must increase exactly
once per pickup. The pickup must disappear, and restarting the scene must
restore it. Check compilation and Play Mode behavior. Report what you
actually tested and anything you could not verify.`}</Prompt>
      <h3>What counts as done?</h3>
      <ul>
        <li>The player can collect it; an unrelated object cannot.</li>
        <li>Repeated collider contacts cannot award the same pickup twice.</li>
        <li>Restarting restores the intended starting score and pickup.</li>
        <li>The Console has no new errors, and the saved scene has no missing references.</li>
      </ul>
      <p>These are suggested acceptance checks, not a claim that generated code is already tested. Ask for an Edit Mode test for scoring logic and a Play Mode check for the scene interaction where the project’s test setup supports them.</p>
    </Section>

    <Section id="prompts" title="4. Give the agent enough context">
      <p>Include the exact Editor and package versions, target device, expected behavior, and the smallest useful error log. Point to a scene or component instead of asking it to fix the whole game.</p>
      <h3>Debug a problem</h3>
      <Prompt>{`Expected: [what should happen]. Actual: [what happens instead].
Reproduce it in [scene] with these steps: [steps].
Inspect [component] and this Console error: [error].
Find the cause before editing. Make the smallest fix, then repeat the
same steps and report the result.`}</Prompt>
      <h3>Check performance</h3>
      <Prompt>{`Measure [scene or feature] on [target device/build]. Record frame time,
allocations, and memory before changing anything. Find the largest
measured cost, propose one change, and compare the same workload after.
Keep the visible result and gameplay behavior the same.`}</Prompt>
      <p>Keep reusable project rules in your agent’s instruction file: UI framework, input system, code conventions, files it may edit, and how to run checks. Smaller tasks and focused logs also reduce repeated tool calls and model usage.</p>
    </Section>

    <Section id="sentis" title="5. Run a model with Sentis">
      <p>Sentis runs trained models; it does not train a model from a prompt. Start with a supplied sample whose input and output you understand before connecting inference to gameplay. <Source id="samples" />.</p>
      <p>For the 2.6 documentation used here, the package is <code>com.unity.ai.inference</code> and the C# namespace is <code>Unity.InferenceEngine</code>. The package display name changed back to <strong>Sentis</strong> in 2.4. Match examples to your installed package rather than mixing old and new APIs. <Source id="sentis" />.</p>
      <ol>
        <li><strong>Get a baseline.</strong> Install a compatible Sentis package and run one of its starter samples unchanged.</li>
        <li><strong>Inspect the model contract.</strong> Record the input names, shapes, data types, and preprocessing, plus the meaning of each output. A tensor is the shaped array of numbers passed to or returned by the model.</li>
        <li><strong>Load and run.</strong> Load the model, create a worker for a supported CPU or GPU backend, prepare the input tensor, and schedule inference.</li>
        <li><strong>Check the output.</strong> Compare one known input with its expected result before using it to change gameplay. Scheduled work can still be running when the call returns.</li>
        <li><strong>Measure a player build.</strong> Check inference time, memory, model download size, and output readback on the actual target device.</li>
      </ol>
      <p className={styles.note}>API sequence and supported model formats: <Source id="workflow" />.</p>
      <h3>A useful first task</h3>
      <Prompt>{`Using this project's installed Sentis version, explain the chosen sample's
input shape, preprocessing, output meaning, and backend. Run the sample
with a known input before changing it. Then propose how its output could
feed one game behavior. Include a fallback when no result is ready and a
plan for measuring it on our target device.`}</Prompt>
      <p>Set a frame-time and memory budget before adding a larger model. Start with the lowest inference frequency that supports the feature, reuse workers where appropriate, and follow the installed package’s ownership and disposal rules for tensors. Avoid blocking the main thread while waiting for a result.</p>
      <p>For a character that simply walks to a target, ordinary navigation may be sufficient. A neural model is useful when its learned behavior solves a problem your existing game logic does not.</p>
    </Section>

    <Section id="troubleshooting" title="6. When things go wrong">
      <dl className={styles.troubleshooting}>
        <dt>The agent cannot see the Editor</dt><dd>Confirm the project is open, compilation has finished, and <code>unity pipeline list</code> reports the package installed. Select the project explicitly if more than one Editor is open.</dd>
        <dt>A command or API is missing</dt><dd>Inspect <code>unity --help</code> and <code>unity command</code>, then use documentation for your installed package. Do not keep retrying a command copied from a different version.</dd>
        <dt>The script compiles, but nothing happens</dt><dd>Check the active scene, attached components, enabled objects, and Inspector references. Test the actual interaction in Play Mode.</dd>
        <dt>Sentis returns an unexpected result</dt><dd>Compare input shape, normalization, channel order, and output interpretation with the working sample. Change one part at a time.</dd>
        <dt>A model works in the Editor but is too slow in a build</dt><dd>Measure on the target device. Try a smaller model or lower inference frequency, and inspect output readback costs before changing backends.</dd>
      </dl>
    </Section>

    <Section id="resources" title="7. Keep learning">
      <p>These links were selected from the site’s indexed resources and checked against official documentation. The guide is reviewed editorially; it does not change automatically when a new resource is indexed.</p>
      <ul className={styles.sources}>{Object.entries(sources).map(([id, source]) => <li key={id}><ExternalLink href={source.url}>{source.title}</ExternalLink><span>{source.detail}</span></li>)}</ul>
      <p>Continue with <a href="/resources?q=Unity%20CLI">CLI resources</a>, <a href="/resources?q=Sentis">Sentis resources</a>, <a href="/packages?q=com.unity.ai.inference">Sentis package history</a>{productUpdateNavigationEnabled() && <>, or <a href="/updates/editor-tooling">Editor tooling updates</a></>}. Use <a href="/compare">Compare versions</a> before changing your project’s Editor version.</p>
    </Section>
  </article>;
}
