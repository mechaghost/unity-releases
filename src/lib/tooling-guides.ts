const pipelineDocs = "https://docs.unity3d.com/Packages/com.unity.pipeline@1.0/manual/";
const cliDocs = "https://docs.unity.com/en-us/unity-cli/";
export const TOOLING_REVIEWED = "2026-11-17";
type Feature = { title: string; description: string; source: string };
export type ToolingGuide = {
  slug: string; name: string; role: string; summary: string; version: string; status: string;
  released: string; headline: string; changes: string[]; migration: string; changelog: string;
  requirements: string; setup: string; setupSource: string; features: Feature[];
};
const pipelineFeature = (title: string, description: string, page: string): Feature => ({ title, description, source: `${pipelineDocs}${page}.html` });
const cliReferences = {
  "editors-and-modules": "editor-project-commands#editors-and-modules",
  "projects-builds-and-templates": "editor-project-commands#projects-builds-and-templates",
  "accounts-licenses-and-unity-cloud": "accounts-licenses-cloud-commands#accounts-licenses-and-unity-cloud",
  "version-control": "uvcs-commands",
  "unity-collaboration": "accounts-licenses-cloud-commands#unity-collaboration",
  "connected-editors-and-ai-agents": "editor-project-commands#connected-editors-and-ai-agents",
  "diagnostics-and-configuration": "cli-config-diagnostics-commands#diagnostics-and-configuration",
  "output-formats-and-automation": "output-formats",
  "cli-lifecycle": "cli-config-diagnostics-commands#cli-lifecycle"
} as const;
const cliFeature = (title: string, description: string, section: keyof typeof cliReferences): Feature => ({ title, description, source: `${cliDocs}reference/${cliReferences[section]}` });
export const TOOLING_GUIDES: ToolingGuide[] = [
  {
    slug: "unity-pipeline", name: "Unity Pipeline", role: "Automate the Editor", version: "1.0.0", status: "Stable", released: "2026-11-11",
    summary: "Create scenes and assets, run tests and builds, and inspect a running game through commands your scripts and coding agents can use.",
    headline: "Pipeline 1.0 is stable",
    changes: [
      "1.0.0: The changelog dates the stable release to November 11. Unity announced it on November 12 as a promotion of 1.0.0-pre.1 with no code changes, then presented CLI and Pipeline 1.0 together at Unite Tokyo on November 17.",
      "1.0: Unity commits to backward-compatible changes and a stable API with a deprecation mechanism. Review the changelog when moving from an experimental package.",
      "0.9.1: Custom commands can use dotted names to declare their group. A description-only attribute can infer the group and command name from your code.",
      "0.9.1: Fixed the pre-build exception on Android, iOS, and other non-Standalone targets that prevented runtime settings from being baked into the build.",
      "0.9.1: Fixed AutoStaticsCleanup analyzer warnings when opening projects in Unity 7.0.",
      "0.9.0: Added Build Profile creation and editing, platform discovery, and controls for keeping Play Mode running while the Editor is unfocused.",
      "0.9.0: Added grouped command discovery, per-command timeouts, and status requests that can respond while another command runs. Code Reload is now called Method Reload."
    ],
    migration: "From 1.0.0-pre.1, Unity reports no code changes. From experimental versions, review the removed APIs and command names: use unity command <group> <name> and discover the current names with unity command. script eval returns its value directly; check exit code 6 for a failed eval instead of a success field.",
    changelog: "https://docs.unity3d.com/Packages/com.unity.pipeline@1.0/changelog/CHANGELOG.html",
    requirements: "Requires Unity 6.0 or later, Unity CLI, and the com.unity.pipeline package in your project. The package connects to a running Editor through a local HTTP API. Unity’s separate hosted Production Pipeline API is in beta. Player access needs its own runtime setup.",
    setup: "unity auth login\nunity pipeline install\n# Return to Unity and wait for compilation.\nunity pipeline editors\nunity command\n# Choose a project when several Editors are open:\nunity command --project-path=<path-to-your-project>",
    setupSource: `${cliDocs}unity-pipeline/unity-pipeline-package`,
    features: [
      pipelineFeature("Assets and files", "Find, create, import, move, copy, rename, and delete assets. Read and change importer settings, create folders, and work with text files.", "commands/assets-and-files"),
      pipelineFeature("Scenes", "Create, open, and save scenes, inspect their hierarchy, choose the active scene, and manage which scenes go into a build.", "commands/scenes"),
      pipelineFeature("GameObjects and components", "Find and create objects, change transforms and parenting, set tags and layers, and inspect or edit component properties.", "commands/gameobjects-and-components"),
      pipelineFeature("Prefabs", "Create prefabs and variants, instantiate them, apply or revert overrides, unpack instances, and edit prefab contents.", "commands/prefabs"),
      pipelineFeature("Scripts and serialized fields", "Create and attach scripts, read or change serialized values, and compile a C# entry point in memory for an automation task.", "commands/scripts"),
      pipelineFeature("Animation and Timeline", "Build animation clips and curves, configure Animator layers, parameters, states and transitions, and author Timeline tracks and clips.", "commands/animation"),
      pipelineFeature("Materials and shaders", "Inspect shader properties, edit material values and keywords, and discover the shaders available to the project.", "commands/materials"),
      pipelineFeature("Lighting, navigation, and occlusion", "Start or clear lighting, NavMesh, and occlusion bakes. Poll their progress or cancel a bake when needed.", "commands/baking"),
      pipelineFeature("Selection and search", "Read or change the Editor selection and use Unity Search to locate project content.", "commands/navigation"),
      pipelineFeature("Screenshots and UI captures", "Capture the Game view, Scene view, and UI Toolkit elements so a script or agent can check the visible result.", "commands/capture"),
      pipelineFeature("Builds, compilation, and tests", "Build Players, manage build targets and profiles, recompile scripts, and run tests with status polling for longer work.", "commands/build-and-compilation"),
      pipelineFeature("Project settings", "Inspect and change audio, graphics, input, physics, Player, quality, tags, layers, and time settings. Changes follow confirmation and dry-run rules.", "commands/project-settings"),
      pipelineFeature("Package Manager", "List, search, add, remove, and resolve project packages, with status checks for operations that take time.", "commands/package-manager"),
      pipelineFeature("Editor control and diagnostics", "Enter, stop, or pause Play Mode, invoke menus, read Console logs, and inspect performance statistics.", "commands/editor-lifecycle-and-observability"),
      pipelineFeature("Multiplayer Play Mode", "Author and run Play Mode Scenarios, discover virtual-player instances, and direct each instance separately.", "commands/multiplayer-play-mode"),
      pipelineFeature("Player commands", "Inspect a connected Player, adjust frame rate or time scale, read logs, and run supported runtime commands.", "commands/runtime"),
      pipelineFeature("Batches and background jobs", "Group operations into one request with shared results and a single Undo step. Longer work can run as a job whose progress you check separately.", "commands/batch"),
      pipelineFeature("Wait for a condition", "Wait for an Editor or object state on the server instead of repeatedly asking from your script. Check or cancel the wait as needed.", "commands/wait"),
      pipelineFeature("Method Reload", "Update supported, attributed methods in a running game. Available changes and platforms depend on the reload backend; this does not replace every kind of recompilation.", "method-reload"),
      pipelineFeature("Your own commands", "Expose project-specific operations through command attributes, typed arguments, and command groups. Use the authoring conventions for Undo and safe asset edits.", "creating-commands")
    ]
  },
  {
    slug: "unity-cli", name: "Unity CLI", role: "Unity from your terminal", version: "1.0.1", status: "Stable", released: "2026-11-16",
    summary: "Install Editors, manage projects, automate builds and tests, and connect coding agents to Unity without the Hub desktop app.",
    headline: "Stable CLI, with a 1.0.1 automation update",
    changes: [
      "1.0.1 (November 16): MCP tool filters accept whole Editor command groups. Command manifests include each command’s full path, and log streams use consistent paging fields.",
      "1.0.1: Version-control unlink output removes credentials from remote URLs for every scheme. Piped TSV output now includes headers for more commands; review scripts that previously captured a bare value.",
      "1.0.0 shipped November 12; the November 17 Unite Tokyo announcement introduced CLI and Pipeline 1.0 together. Unity commits to compatible commands, flags, and output across 1.x, with deprecation warnings before removals.",
      "Still coming: the supported Linux containerized Editor. The announcement also places further AI Generators, Live Games, and Build Automation commands on the roadmap.",
      "beta.14: Open a project with --until-ready to wait for the Editor. Blocking dialogs now report a useful error instead of leaving automation waiting indefinitely.",
      "beta.14: Install an Editor into a chosen workspace with --download-directory, and preview another operating system’s downloads with --dry-run --operating-system.",
      "beta.14: Filter which Editor tools an MCP client can see with --tools and --exclude-tools. Discover old command names and their replacements with unity command --obsolete-command-names.",
      "beta.14: Project creation can skip default scaffolding with --bare and reports individual setup steps in structured output. New configuration-path and Editor-terms commands support machine setup.",
      "beta.14: Hardened downloads, credential handling, and diagnostic output. Check the full release notes for platform-specific fixes and security changes.",
      "beta.12: Create projects with Pipeline already installed using --with-pipeline, wait for Editor readiness, and see package release summaries during Pipeline upgrades."
    ],
    migration: "The standalone CLI uses unity commands, rather than the old Hub -- --headless syntax. Check help for your installed version and review exit codes and output before migrating CI scripts. In 1.0.1, piped TSV can include headers: use --json and read the documented fields when capturing values. CLI and Pipeline versions are updated separately.",
    changelog: `${cliDocs}release-notes`,
    requirements: "Supports macOS 14+, Windows 10 21H1+, and supported Linux distributions with glibc 2.34+ (including Ubuntu 22.04+ and RHEL 9). Editor automation also needs Pipeline and Unity 6+. Build machines still need the right Editor, platform modules, and license.",
    setup: "unity --version\nunity --help\nunity auth login\nunity editors -i\nunity doctor\n# Discover commands for your installed version:\nunity commands --grep build",
    setupSource: `${cliDocs}use-unity-cli`,
    features: [
      cliFeature("Editors and platform modules", "Discover Unity releases, install or remove Editors, add platform modules, register existing installations, and choose an Editor default.", "editors-and-modules"),
      cliFeature("Projects, templates, and assets", "Create, clone, open, and organize projects. Manage reusable templates and inspect, import, or export .unitypackage assets.", "projects-builds-and-templates"),
      cliFeature("Builds and tests", "Run batch builds and Edit Mode or Play Mode tests, save NUnit reports, discover Build Profiles, and recompile scripts. Watch a project to repeat checks after edits.", "projects-builds-and-templates"),
      cliFeature("Accounts, licenses, and cloud projects", "Manage sign-in and local licenses, inspect organizations and projects, and link local work to Unity Cloud.", "accounts-licenses-and-unity-cloud"),
      cliFeature("Unity-aware version control", "Work with Git, GitHub, GitLab, or Unity Version Control. Check .meta pairing, configure scene merging, inspect conflicts, and compare scene changes by object and component.", "version-control"),
      cliFeature("Collaboration", "Work with Unity Collaboration annotations, attachments, thumbnails, reactions, and linked Jira issues.", "unity-collaboration"),
      cliFeature("Pipeline and connected Editors", "Install or upgrade Pipeline, discover running Editors, send commands, inspect command schemas, and track detached jobs. Cloud-build and automation commands also read hosted service information.", "connected-editors-and-ai-agents"),
      cliFeature("Coding agents and MCP", "Expose Editor tools through Model Context Protocol, configure supported clients, and install or read Unity’s CLI skill. The command manifest gives agents structured discovery.", "connected-editors-and-ai-agents"),
      cliFeature("Diagnostics and configuration", "Check environment health, inspect logs, manage proxy and Accelerator settings, switch saved contexts, manage plugins, and find version-specific documentation.", "diagnostics-and-configuration"),
      cliFeature("Structured automation output", "Use JSON, NDJSON, or TSV for scripts. Check documented exit codes and output contracts so failures and incomplete results are handled correctly.", "output-formats-and-automation"),
      cliFeature("Updates and shell tools", "Check the CLI version, read its changelog, and update it. Shell completion and an interactive session make repeated terminal work easier. Package-manager installs have their own update rules.", "cli-lifecycle")
    ]
  }
];
