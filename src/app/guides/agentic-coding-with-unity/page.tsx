import { Icon } from "../../_components/Icon";
import { ExternalLink } from "../../_components/ExternalLink";
import { pageSocialMetadata } from "@/lib/site";
import { AGENTIC_GUIDE_EXAMPLES } from "@/lib/agentic-guide-examples";
import styles from "./page.module.css";

const title = "Agentic Coding with Unity";
const description = "Use coding agents with Unity CLI and Pipeline for CI/CD, gameplay tests, deployment, asset checks, and performance checks.";
export const metadata = {
  title, description,
  alternates: { canonical: "/guides/agentic-coding-with-unity" },
  ...pageSocialMetadata({ title, description, path: "/guides/agentic-coding-with-unity" })
};

const workingLoop: { title: string; description: string; image: string }[] = [
  { title: "Describe the task", description: "You define the goal and what success looks like.", image: "describe" },
  { title: "Make the change", description: "The agent inspects the project and edits code or assets.", image: "change" },
  { title: "Run checks", description: "Unity runs the tests or build. Scripts save results and logs.", image: "checks" },
  { title: "Review the result", description: "You check the changes, test results, and game behavior.", image: "review" }
];

export default function AiWithUnityPage() {
  return <article className={styles.guide}>
    <header className="page-header">
      <h1>{title}</h1>
      <p>Agentic coding means giving a coding agent a task it can carry out and check. Use Unity CLI and the Pipeline package to automate tests, builds, and repetitive Editor work.</p>
    </header>
    <div className={styles.overview}>
      <dl className={styles.tools}>
        <div className={`guide-card ${styles.toolCard}`}>
          <dt>Unity CLI: the terminal tool</dt>
          <dd>Install Editors and platform modules, open projects, and run commands from scripts or CI. It works without the Hub desktop app. <ExternalLink href="https://docs.unity.com/en-us/unity-cli/use-unity-cli">Install and use the CLI</ExternalLink>.</dd>
        </div>
        <div className={`guide-card ${styles.toolCard}`}>
          <dt>Unity Pipeline: the Editor connection</dt>
          <dd>A package inside your Unity 6+ project. It exposes Editor commands through a local API, so an agent can inspect and change the project through the CLI. <ExternalLink href="https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package">Pipeline setup and commands</ExternalLink>.</dd>
        </div>
      </dl>
      <figure className={styles.loop} aria-labelledby="working-loop-caption">
        <figcaption id="working-loop-caption">The working loop</figcaption>
        <ol className={styles.loopSteps}>
          {workingLoop.map((step, index) => <li key={step.title}>
            <div className={styles.loopSymbol}><img src={`/images/agentic-workflow/${step.image}.webp`} width={256} height={256} alt="" decoding="async" /></div>
            <strong>{index + 1}. {step.title}</strong>
            <span className={styles.loopDescription}>{step.description}</span>
            {index < workingLoop.length - 1 && <span className={styles.loopArrow}><Icon name="arrow-right" size={32} strokeWidth={2.5} /></span>}
          </li>)}
        </ol>
      </figure>
    </div>

    <details id="setup" className={styles.setup}>
      <summary>Connect your coding agent</summary>
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

    <h2 className={styles.examplesHeading}>Example workflows</h2>
    <p className={styles.intro}>These examples draw on <ExternalLink href="https://mechadrive.games">Mecha Drive</ExternalLink>, a vibe-coded Unity game. Each workflow notes what was verified.</p>
    <div className={`guide-grid ${styles.cards}`}>
      {AGENTIC_GUIDE_EXAMPLES.map((example, index) => <section className={`guide-card ${styles.card}`} id={example.id} key={example.id} aria-labelledby={`${example.id}-heading`}>
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
              <p><ExternalLink href={example.link}>{example.linkText}</ExternalLink></p>
            </div>
          </details>
        </div>
      </section>)}
    </div>
  </article>;
}
