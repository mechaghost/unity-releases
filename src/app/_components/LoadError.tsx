export function LoadError({ subject, retryHref }: { subject: string; retryHref: string }) {
  return <div className="empty-state" role="alert">
    <h2>Could not load {subject}.</h2>
    <p>This is a temporary loading problem. Your filters have been kept.</p>
    <a className="btn btn--secondary" href={retryHref}>Try again</a>
  </div>;
}
