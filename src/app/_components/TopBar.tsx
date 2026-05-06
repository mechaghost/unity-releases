import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  return (
    <header className="topbar" role="banner">
      <button
        type="button"
        className="topbar__menu"
        aria-label="Toggle navigation"
        // The menu button is decorative on >=1024 screens; client-side toggle
        // would require a context. Kept as a non-functional affordance for now.
      >
        <Icon name="menu" size={18} />
      </button>

      <form className="topbar__search" action="/releases" method="get" role="search">
        <Icon name="search" size={16} className="topbar__search-icon" />
        <input
          type="search"
          name="q"
          placeholder="Search release notes…"
          aria-label="Search release notes"
          autoComplete="off"
        />
        <span className="topbar__search-hint" aria-hidden="true">
          /
        </span>
      </form>

      <div className="topbar__actions">
        <a className="btn btn--secondary btn--small" href="/compare" title="Compare versions (c)">
          <Icon name="git-compare" size={14} />
          Compare
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
