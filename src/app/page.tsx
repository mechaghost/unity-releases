import ComparePage from "./compare/page";
export { dynamic } from "./compare/page";

export default async function HomePage(props: Parameters<typeof ComparePage>[0]) {
  return <>
    <aside className="guide-home-entry" aria-label="Discover release highlights">
      <a href="/whats-new">What’s new in Unity?</a>
      <span>Explore the big changes in each release, with clear LTS and Supported status.</span>
    </aside>
    <ComparePage {...props} />
  </>;
}
