import { productUpdateNavigationEnabled } from "@/lib/product-updates/flags";
import { Icon, type IconName } from "../_components/Icon";

const sections: { title: string; description: string; href: string; icon: IconName; productUpdates?: boolean }[] = [
  { title: "Editor releases", description: "Latest patches, fixes, and release notes.", href: "/releases", icon: "file-text" },
  { title: "Packages", description: "New package versions and changelogs.", href: "/packages", icon: "package" },
  { title: "Editor tools", description: "Updates to Unity Hub and Unity CLI.", href: "/updates/editor-tooling", icon: "terminal", productUpdates: true },
  { title: "Product updates", description: "What’s changed across Unity products and services.", href: "/updates", icon: "layers", productUpdates: true },
  { title: "Reported issues", description: "Newly reported issues and recent fixes.", href: "/issues", icon: "alert-octagon" },
  { title: "News", description: "Announcements and articles from Unity.", href: "/news", icon: "newspaper" },
  { title: "Resources", description: "New tutorials, guides, and examples.", href: "/resources", icon: "file-text" },
  { title: "Staff discussions", description: "Recent posts and answers from Unity staff.", href: "/discussions", icon: "message-square" },
  { title: "Unity GitHub", description: "Recent activity in Unity repositories.", href: "/github", icon: "github" }
];

export function MoreUpdates() {
  const productsEnabled = productUpdateNavigationEnabled();
  return <section className="more-updates" aria-labelledby="more-updates-heading">
    <div className="page-header__title-row">
      <h2 id="more-updates-heading">More updates</h2>
      <a href="/timeline?filter=content">All activity <span aria-hidden="true">→</span></a>
    </div>
    <div className="guide-grid update-section-grid">
      {sections.filter(section => !section.productUpdates || productsEnabled).map(section =>
        <a key={section.href} className="guide-feature-link update-section-card" href={section.href}>
          <div className="update-section-card__heading"><Icon name={section.icon} size={20} /><h3>{section.title}</h3><span aria-hidden="true">→</span></div>
          <p>{section.description}</p>
        </a>
      )}
    </div>
  </section>;
}
