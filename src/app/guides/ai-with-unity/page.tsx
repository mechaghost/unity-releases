import { ExternalLink } from "../../_components/ExternalLink";
import { pageSocialMetadata } from "@/lib/site";
import { AI_GUIDE_EXAMPLES } from "@/lib/ai-guide-examples";
import styles from "./page.module.css";

const title = "How to use AI with Unity";
const description = "Practical AI workflows for Unity: CI/CD, gameplay tests, deployment, asset checks, performance, and Sentis.";
export const metadata = {
  title, description,
  alternates: { canonical: "/guides/ai-with-unity" },
  ...pageSocialMetadata({ title, description, path: "/guides/ai-with-unity" })
};

export default function AiWithUnityPage() {
  return <article className={styles.guide}>
    <header className="page-header">
      <h1>{title}</h1>
      <p>Use a coding agent with Unity CLI and the Pipeline package to automate tests, builds, and repetitive Editor work.</p>
    </header>
    <div className={styles.overview}>
      <dl className={styles.tools}>
        <div>
          <dt>Unity CLI: the terminal tool</dt>
          <dd>Install Editors and platform modules, open projects, and run commands from scripts or CI. It works without the Hub desktop app. <ExternalLink href="https://docs.unity.com/en-us/unity-cli/use-unity-cli">Install and use the CLI</ExternalLink>.</dd>
        </div>
        <div>
          <dt>Unity Pipeline: the Editor connection</dt>
          <dd>A package inside your Unity 6+ project. It exposes Editor commands through a local API, so an agent can inspect and change the project through the CLI. <ExternalLink href="https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package">Pipeline setup and commands</ExternalLink>.</dd>
        </div>
      </dl>
      <p><strong>The working loop:</strong> describe a task → let the agent inspect and change it → run tests or a build → review the evidence.</p>
      <p>The agent helps create and debug your automation. Saved scripts can run without AI on each run. A CI service runs them when code changes or on a schedule; the Pipeline package provides the Editor connection. <ExternalLink href="https://unity.com/resources/unity-pipeline-cli-technical-walkthrough">See Unity’s technical walkthrough</ExternalLink>.</p>
    </div>

    <details id="setup" className={styles.setup}>
      <summary>First time? Connect your coding agent to Unity</summary>
      <div className={styles.detailBody}>
        <p>Use Unity 6.0 or later and a coding agent that can run terminal commands. Save your work, then <ExternalLink href="https://docs.unity.com/en-us/unity-cli/use-unity-cli">install Unity CLI</ExternalLink>. Reopen your terminal in the project folder with Unity open.</p>
        <pre className={styles.prompt}><code>{`unity auth login
unity pipeline install
# Wait for Unity to finish compiling, then:
unity pipeline list
unity command`}</code></pre>
        <p>Check for your project and <strong>Pipeline: Installed</strong>. If several Editors are open, use <code>unity command --project-path=&lt;path-to-your-project&gt;</code>. <ExternalLink href="https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package">Setup help</ExternalLink>.</p>
        <p>Open your coding agent in this project folder, then choose a prompt below. For CI, the build machine also needs the correct Editor, platform modules, and licensing setup.</p>
      </div>
    </details>

    <h2 className={styles.examplesHeading}>Put it to work</h2>
    <p className={styles.intro}>Choose a task and adapt its platform, scene, and rules to your project. Ask the agent to report changed files, commands run, results, and anything it could not check.</p>
    <div className={`guide-grid ${styles.cards}`}>
      {AI_GUIDE_EXAMPLES.map((example, index) => <section className={`guide-card ${styles.card}`} id={example.id} key={example.id} aria-labelledby={`${example.id}-heading`}>
        <figure>
          <div className="guide-feature-image"><img src={example.image.src} alt={example.image.alt} width={example.image.width} height={example.image.height} loading={index < 2 ? "eager" : "lazy"} decoding="async" /></div>
          <figcaption>Image: <ExternalLink href={example.imageSource}>Unity release announcement</ExternalLink></figcaption>
        </figure>
        <div className={`guide-highlight-copy ${styles.cardBody}`}>
          <div className="guide-badges"><span className="guide-badge">{example.category}</span></div>
          <h2 id={`${example.id}-heading`}>{example.title}</h2>
          <p className={styles.summary}>{example.summary}</p>
          <details className={styles.workflow}>
            <summary aria-label={`View workflow and prompt: ${example.title}`}>View workflow and prompt</summary>
            <div className={styles.detailBody}>
              <p><strong>Give the agent:</strong> {example.needs}</p>
              <h3>Workflow</h3>
              <ol>{example.steps.map(step => <li key={step}>{step}</li>)}</ol>
              <h3>Try this prompt</h3>
              <pre className={styles.prompt}><code>{example.prompt}</code></pre>
              <h3>Check the result</h3>
              <p>{example.checks}</p>
              <h3>Evidence and limits</h3>
              <p>{example.evidence}</p>
              {example.id === "sentis" && <p>Sentis runs trained models on the player’s CPU or GPU; it does not train them. The <ExternalLink href="https://docs.unity3d.com/Packages/com.unity.ai.inference@2.6/manual/get-started.html">2.6 docs</ExternalLink> use <code>com.unity.ai.inference</code> and <code>Unity.InferenceEngine</code>. Match examples to your installed version.</p>}
              <p><ExternalLink href={example.link}>{example.linkText}</ExternalLink></p>
            </div>
          </details>
        </div>
      </section>)}
    </div>
    <footer className={styles.footer}>
      <p>Evidence notes draw on our Unity game, Mecha Drive, and distinguish recorded results from suggested additions. Images show Unity features, not results from these prompts.</p>
      <p>Keep exploring: <a href="/resources?q=Unity%20CLI">Unity CLI resources</a> · <a href="/resources?q=Sentis">Sentis resources</a></p>
      <p>Independent guide · Reviewed October 25, 2026</p>
    </footer>
  </article>;
}
