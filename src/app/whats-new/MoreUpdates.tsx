import { productUpdateNavigationEnabled } from "@/lib/product-updates/flags";
import { getLatestUpdates, type LatestUpdateKey } from "@/lib/latest-updates";
import { formatReleaseDate } from "@/lib/format-date";
import { Icon, type IconName } from "../_components/Icon";

const sections: { key: LatestUpdateKey; title: string; href: string; icon: IconName; productUpdates?: boolean }[] = [
  { key: "releases", title: "Editor releases", href: "/releases", icon: "file-text" },
  { key: "packages", title: "Packages", href: "/packages", icon: "package" },
  { key: "editor-tools", title: "Editor tools", href: "/updates/editor-tooling", icon: "terminal", productUpdates: true },
  { key: "products", title: "Product updates", href: "/updates", icon: "layers", productUpdates: true },
  { key: "issues", title: "Reported issues", href: "/issues", icon: "alert-octagon" },
  { key: "news", title: "News", href: "/news", icon: "newspaper" },
  { key: "resources", title: "Resources", href: "/resources", icon: "file-text" },
  { key: "discussions", title: "Staff discussions", href: "/discussions", icon: "message-square" },
  { key: "github", title: "Unity GitHub", href: "/github", icon: "github" }
];

export async function MoreUpdates() {
  const productsEnabled = productUpdateNavigationEnabled();
  const updates = await getLatestUpdates(productsEnabled);
  return <section className="more-updates" aria-labelledby="more-updates-heading">
    <div className="page-header__title-row">
      <h2 id="more-updates-heading">More updates</h2>
      <a href="/timeline?filter=content">All activity <span aria-hidden="true">→</span></a>
    </div>
    <div className="guide-grid update-section-grid">
      {sections.filter(section => !section.productUpdates || productsEnabled).map(section => {
        const { item, unavailable } = updates[section.key];
        return <a key={section.href} className="guide-feature-link update-section-card" href={section.href}>
          <div className="update-section-card__heading"><Icon name={section.icon} size={20} /><h3>{section.title}</h3><span aria-hidden="true">→</span></div>
          {item ? <>
            <p className="update-section-card__title">{item.title}</p>
            {item.summary && <p className="update-section-card__summary">{item.summary}</p>}
            <span className="update-section-card__date">{item.date
              ? <>{item.dateLabel ?? "Published"} <time dateTime={item.date}>{formatReleaseDate(item.date)}</time></>
              : "Publication date unavailable"}</span>
          </> : <p>{unavailable ? "Updates unavailable" : "No updates indexed"}</p>}
        </a>;
      })}
    </div>
  </section>;
}
