import { ExternalLink } from "../../_components/ExternalLink";
import { pageSocialMetadata } from "@/lib/site";
import styles from "./page.module.css";

const title = "How to use AI with Unity";
const description = "A quick start for building with an AI agent in Unity, plus a simple introduction to Sentis.";
export const metadata = {
  title, description,
  alternates: { canonical: "/guides/ai-with-unity" },
  ...pageSocialMetadata({ title, description, path: "/guides/ai-with-unity" })
};
const cliDocs = "https://docs.unity.com/en-us/unity-cli/use-unity-cli";
const pipelineDocs = "https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package";
const cliTutorial = "https://unity.com/resources/a-beginners-guide-to-unity-cli-and-the-pipeline-package";
const sentisDocs = "https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/get-started.html";

export default function AiWithUnityPage() {
  return <article className={styles.guide}>
    <header className="page-header">
      <h1>{title}</h1>
      <p>Let AI help you build in the Editor—or use Sentis to run AI inside your game.</p>
    </header>

    <nav className={styles.paths} aria-label="On this page">
      <figure>
        <a href="#setup" className={styles.pathLink}>
          <img src="/images/ai-guide/rotating-cube.webp" alt="A cube in Unity’s Game view, from Unity’s CLI tutorial" width={640} height={414} decoding="async" />
          <h2>Build with an AI agent <span aria-hidden="true">→</span></h2>
          <p>Create objects, write scripts, and fix bugs.</p>
        </a>
        <figcaption>Image: <ExternalLink href={cliTutorial}>Unity CLI tutorial</ExternalLink> · still from the demo</figcaption>
      </figure>
      <figure>
        <a href="#sentis" className={styles.pathLink}>
          <img src="/images/release-guides/6.0-5.webp" alt="Unity’s Sentis demo showing a virtual character alongside a player’s tracked movement" width={1200} height={675} decoding="async" />
          <h2>Run a model with Sentis <span aria-hidden="true">→</span></h2>
          <p>Use a trained model on the player’s device.</p>
        </a>
        <figcaption>Image: <ExternalLink href="https://unity.com/blog/unity-6-features-announcement">Unity 6 release announcement</ExternalLink></figcaption>
      </figure>
    </nav>

    <section id="setup" className={styles.section} aria-labelledby="setup-heading">
      <h2 id="setup-heading">1. Connect your agent to Unity</h2>
      <p>You’ll need <strong>Unity 6.0 or later</strong> and a coding agent that can run terminal commands. Save your project before starting.</p>
      <ol>
        <li><ExternalLink href={cliDocs}>Install Unity CLI</ExternalLink> for your computer.</li>
        <li>Open your Unity project. Open a terminal in the same project folder.</li>
        <li>Run these commands, waiting for Unity to finish compiling after installation:</li>
      </ol>
      <pre className={styles.prompt}><code>{`unity auth login
unity pipeline install
unity pipeline list`}</code></pre>
      <p>Look for <strong>Pipeline: Installed</strong> and your project’s name. That means the connection is ready. <ExternalLink href={pipelineDocs}>Setup help</ExternalLink>.</p>
    </section>

    <section id="first-feature" className={styles.section} aria-labelledby="first-feature-heading">
      <h2 id="first-feature-heading">2. Ask for something small</h2>
      <p>Open your coding agent in the project folder. Try this:</p>
      <pre className={styles.prompt}><code>{`Check which Unity project is open using unity command.
In a new test scene, create a cube that rotates slowly.
Add a camera so I can see it. Keep my existing scenes unchanged.
Run it in Play Mode and check the Console for errors.`}</code></pre>
      <p>Once that works, try a small task from your own game. Name the scene, describe the result you want, and say what should stay unchanged.</p>
    </section>

    <section id="check" className={styles.section} aria-labelledby="check-heading">
      <h2 id="check-heading">3. Press Play and check</h2>
      <ul>
        <li><strong>Does it work?</strong> Watch the cube rotate.</li>
        <li><strong>Any errors?</strong> Check Unity’s Console.</li>
        <li><strong>Did it save?</strong> Stop Play Mode, reopen the scene, and try again.</li>
      </ul>
      <p>Review the changed files before keeping them. If something breaks, give the agent the exact error and ask for one focused fix.</p>
    </section>

    <section id="sentis" className={styles.section} aria-labelledby="sentis-heading">
      <h2 id="sentis-heading">Want AI inside your game? Use Sentis</h2>
      <p>Sentis runs a trained model on the player’s CPU or GPU. It can turn input—such as an image—into a result your game can use.</p>
      <ol>
        <li><strong>Start with a sample.</strong> Follow the <ExternalLink href={sentisDocs}>Sentis getting-started guide</ExternalLink> and run an example unchanged.</li>
        <li><strong>Understand the result.</strong> Check what goes into the model and what comes out.</li>
        <li><strong>Try it on your target device.</strong> Check speed and memory before building a feature around it.</li>
      </ol>
      <details className={styles.details}>
        <summary>Which Sentis package?</summary>
        <p>The linked docs cover Sentis 2.6: package <code>com.unity.ai.inference</code>, namespace <code>Unity.InferenceEngine</code>. Use examples that match your installed version. Sentis runs models; it does not train them.</p>
      </details>
    </section>

    <footer className={styles.footer}>
      <p>Go further: <ExternalLink href={cliTutorial}>Unity’s full CLI tutorial</ExternalLink> · <a href="/resources?q=Sentis">Sentis resources</a></p>
      <p>Independent guide · Reviewed October 25, 2026 · Images from Unity</p>
    </footer>
  </article>;
}
