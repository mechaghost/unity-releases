# November 13: invalidate incompatible live-link checkpoints

The [failed run](https://github.com/mechaghost/unity-releases/actions/runs/43471452447)
resumed a November 4 checkpoint. Its 29 carried failures predate current rendering
and audit fixes: 24 retired GUID routes, four removed historical issue anchors,
and the real numeric issue `/issues/404/slug` (UUM-10786). These are historical
observations, not 29 newly broken live links.

The CI cache now partitions checkpoints by the release branch's rendering inputs
and the executing audit's code, transitive link helpers, dependencies and workflow.
Restore has no fallback to a different fingerprint or the old v1 namespace.
Existing caches and artifacts are retained. Relevant code changes cause one new
crawl; documentation-only commits and unchanged scheduled runs preserve progress.
No production runtime, Railway configuration, failure classification, scan limit
or incomplete-coverage behavior changed. A passing slice still does not mean a
complete crawl. Database-only content changes are not fingerprinted; completed
crawls already start a new cycle. The release branch is the deployment input, not
proof that deployment has completed; this repair was made after ce528b4 deployed.

Validation: 53 focused link/normalization tests passed. The process interruption
regression initially timed out in the sandbox, then passed with localhost server
access. Rendering hashes are equal for ce528b4 and docs-only 8164f28, and differ
from a800908, verifying both preservation and invalidation with actual history.
CI execution and a newly dispatched live audit provide the remaining remote check;
full live coverage may span multiple daily slices.
