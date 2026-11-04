/** One incident per outage; recovery closes only the monitor's own issue. */
module.exports = async function reconcile({ github, context, failed, details }) {
  const marker = '<!-- unity-releases-health-monitor-v1 -->';
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const issues = await github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'open', per_page: 100 });
  const incident = issues.find(issue => !issue.pull_request && issue.user?.login === 'github-actions[bot]' && issue.body?.includes(marker));
  const runUrl = `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`;
  if (failed && !incident) {
    await github.rest.issues.create({ ...repo, title: 'Production ingestion health needs attention',
      body: `${marker}\n\nThe scheduled health check failed.\n\n${details}\n\n[Check results](${runUrl})\n\nThis issue closes automatically after both health checks recover.` });
  } else if (!failed && incident) {
    await github.rest.issues.createComment({ ...repo, issue_number: incident.number, body: `Both health checks recovered. [Successful check](${runUrl})` });
    await github.rest.issues.update({ ...repo, issue_number: incident.number, state: 'closed', state_reason: 'completed' });
  }
};
