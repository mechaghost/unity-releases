# Unity Releases Agent Notes

These are project conventions for Codex sessions working in this repository.

## Completion Workflow

- When work is done, commit the finished state on `main` unless the user explicitly asks for a different branch workflow.
- Before committing, run the relevant verification for the change and check `git status`.
- Do not leave completed implementation only in a feature branch or worktree.
- Preserve unrelated user changes. If they affect the task, work with them instead of reverting them.

## Railway Release Workflow

- In this project, the word `release` means Railway deployment via the Git branch named `release`.
- Do not interpret `release` as a GitHub release, tag, or changelog operation unless the user explicitly says so.
- When the user asks to release/deploy, update the `release` branch from the verified `main` state and push `release` for Railway to deploy.
- Do not force-push or rewrite the `release` branch unless the user explicitly approves that operation.
