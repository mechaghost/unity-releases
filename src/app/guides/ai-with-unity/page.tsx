import { Icon, type IconName } from "../../_components/Icon";
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

const workingLoop: { title: string; role: string; description: string; icon: IconName }[] = [
  { title: "Describe", role: "You", description: "Set the task and what success looks like.", icon: "message-square" },
  { title: "Make the change", role: "Agent", description: "Inspect the project, then edit code or assets.", icon: "sparkles" },
  { title: "Run checks", role: "Unity + scripts", description: "Run tests or a build. Save results and logs.", icon: "terminal" },
  { title: "Review", role: "You", description: "Check the diff, results, and game behavior.", icon: "check" }
];

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
      <figure className={styles.loop} aria-labelledby="working-loop-caption">
        <figcaption id="working-loop-caption">The working loop</figcaption>
        <ol className={styles.loopSteps}>
          {workingLoop.map((step, index) => <li key={step.title}>
            <div className={styles.loopSymbol}><Icon name={step.icon} size={24} /></div>
            <span className={styles.loopRole}>{index + 1} · {step.role}</span>
            <strong>{step.title}</strong>
            <span className={styles.loopDescription}>{step.description}</span>
            {index < workingLoop.length - 1 && <span className={styles.loopArrow}><Icon name="arrow-right" size={20} /></span>}
          </li>)}
        </ol>
        <div className={styles.loopReturn}><span aria-hidden="true">↶</span> Need a change? Refine the task and repeat.</div>
      </figure>
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
    <p className={styles.intro}><ExternalLink href="https://mechadrive.games">Mecha Drive</ExternalLink> is a vibe-coded Unity game we used to check these workflows in practice. Each card explains what was verified in the game and what is still a suggested addition.</p>
    <p className={styles.intro}>Adapt the prompts to your project. Ask the agent to report changed files, commands run, results, and anything it could not check.</p>
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
      <p>Images show Unity features, not results from these prompts.</p>
      <p>Keep exploring: <a href="/resources?q=Unity%20CLI">Unity CLI resources</a> · <a href="/resources?q=Sentis">Sentis resources</a></p>
      <p>Independent guide · Reviewed October 25, 2026</p>
    </footer>
  </article>;
}
