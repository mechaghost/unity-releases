import type { Metadata } from "next";
import { listTimelineFeed, type TimelineEvent } from "@/lib/db/repositories";
import { TimelineFilter } from "../_components/TimelineFilter";
import { Icon, type IconName } from "../_components/Icon";
import { formatRelativeDate } from "@/lib/format-date";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

const TIMELINE_DESCRIPTION =
  "Real-time feed tracking Unity Editor releases, package updates, news posts, and the operational status of database scraper cron jobs.";

export const metadata: Metadata = {
  title: "Activity Feed",
  description: TIMELINE_DESCRIPTION,
  alternates: { canonical: "/timeline" },
  ...pageSocialMetadata({
    title: "Activity Feed",
    description: TIMELINE_DESCRIPTION,
    path: "/timeline"
  })
};

type SearchParams = Promise<{
  q?: string;
  filter?: string;
}>;

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const filterKey = (params.filter ?? "all") as "all" | "content" | "system" | "failures";

  // Fetch unified timeline history
  const allEvents = await safeListTimelineFeed();

  // Apply filters
  let filtered = allEvents;
  if (filterKey === "content") {
    filtered = filtered.filter((e) => e.type === "content");
  } else if (filterKey === "system") {
    filtered = filtered.filter((e) => e.type === "ingestion");
  } else if (filterKey === "failures") {
    filtered = filtered.filter((e) => e.type === "ingestion" && e.status === "failed");
  }

  if (q) {
    filtered = filtered.filter((e) => {
      if (e.type === "content") {
        return (
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.eventType.toLowerCase().includes(q)
        );
      } else {
        return (
          e.jobName.toLowerCase().includes(q) ||
          e.sourceType.toLowerCase().includes(q) ||
          (e.errorMessage && e.errorMessage.toLowerCase().includes(q))
        );
      }
    });
  }

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Activity &amp; Ingestion Feed</h1>
        </div>
        <p>
          Chronological logs tracking Unity dataset updates and background scraping cron job status.
        </p>
      </section>

      <div className="packages-settings">
        <TimelineFilter q={params.q ?? ""} filter={filterKey} />
      </div>

      <div className="timeline-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h2>No activity logs found.</h2>
            <p>Try clearing search or picking another filter option.</p>
          </div>
        ) : (
          <div className="timeline">
            <div className="timeline__track" />
            <ol className="timeline__list">
              {filtered.map((item) => (
                <li key={item.id} className="timeline__item">
                  <TimelineNode event={item} />
                  <div className="timeline__card">
                    <header className="timeline__card-header">
                      <span className="timeline__card-time" title={formatDateTime(item.timestamp)}>
                        {formatDateTime(item.timestamp)} · <span className="timeline__card-relative">{formatRelativeDate(item.timestamp)}</span>
                      </span>
                    </header>
                    <div className="timeline__card-body">
                      <TimelineCardBody event={item} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}

function TimelineNode({ event }: { event: TimelineEvent }) {
  let iconName: IconName = "info";
  let variant = "default";

  if (event.type === "content") {
    if (event.eventType === "unity_release") {
      iconName = "rocket";
      variant = "release";
    } else if (event.eventType === "package_version" || event.eventType === "package_version_group") {
      iconName = "package";
      variant = "package";
    } else if (event.eventType === "blog_post" || event.eventType === "blog_post_group") {
      iconName = "newspaper";
      variant = "news";
    }
  } else {
    // Ingestion run
    if (event.status === "failed") {
      iconName = "alert-octagon";
      variant = "failure";
    } else if (event.status === "running") {
      iconName = "activity";
      variant = "running";
    } else {
      // Success
      iconName = "check";
      // Highlight if changes were pulled, else make it subtle/success-subtle
      const hasChanges = event.recordsCreated > 0 || event.recordsUpdated > 0 || event.recordsDeleted > 0;
      variant = hasChanges ? "success-changes" : "success";
    }
  }

  return (
    <div className={`timeline__node timeline__node--${variant}`}>
      <Icon name={iconName} size={16} />
    </div>
  );
}

function TimelineCardBody({ event }: { event: TimelineEvent }) {
  if (event.type === "content") {
    if (event.isGroup && event.groupItems) {
      const isPackageGroup = event.eventType === "package_version_group";
      const isNewsGroup = event.eventType === "blog_post_group";
      
      return (
        <div className="timeline-content">
          <h2 className="timeline-content__title">
            {event.title}
          </h2>
          
          <div className="timeline-content__run-updates timeline-content__run-updates--flush">
            <ul className="timeline-run-updates-list">
              {event.groupItems.map((item) => {
                const isEditorItem = event.eventType.startsWith("unity_release");
                const isPackageItem = event.eventType.startsWith("package_version");
                
                let href = item.sourceUrl;
                let target: string | undefined = "_blank";
                
                if (isEditorItem) {
                  href = `/releases/${encodeURIComponent(item.title)}`;
                  target = undefined;
                } else if (isPackageItem) {
                  href = `/packages?q=${encodeURIComponent(item.title.split(" ")[0] || "")}`;
                  target = undefined;
                }
                
                return (
                  <li key={item.id}>
                    <span className={`chip chip--small chip--event-${event.eventType.replace("_group", "")}`}>
                      {isPackageGroup ? "package" : isNewsGroup ? "news" : "update"}
                    </span>
                    <a href={href} target={target} rel={target ? "noopener noreferrer" : undefined}>
                      {item.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
          
          <div className="timeline-content__footer">
            {event.tags && event.tags.length > 0 && (
              <div className="timeline-content__tags">
                {event.tags.map((tag) => (
                  <span key={tag} className="chip chip--small">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    const isEditor = event.eventType === "unity_release";
    const isPackage = event.eventType === "package_version";
    const isNews = event.eventType === "blog_post";

    return (
      <div className="timeline-content">
        <h2 className="timeline-content__title">
          {isEditor && (
            <a href={`/releases/${encodeURIComponent(event.title)}`}>
              Editor Released: <strong>{event.title}</strong>
            </a>
          )}
          {isPackage && (
            <a href={`/packages?q=${encodeURIComponent(event.title.split(" ")[0] || "")}`}>
              Package Updated: <strong>{event.title}</strong>
            </a>
          )}
          {isNews && (
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
              News: <strong>{event.title}</strong>
            </a>
          )}
        </h2>

        {event.summary && (
          <p className="timeline-content__summary">
            {event.summary.replace(/<[^>]*>/g, "").slice(0, 300)}
            {event.summary.length > 300 ? "..." : ""}
          </p>
        )}

        <div className="timeline-content__footer">
          {event.tags && event.tags.length > 0 && (
            <div className="timeline-content__tags">
              {event.tags.map((tag) => (
                <span key={tag} className="chip chip--small">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <a
            href={isEditor ? `/releases/${encodeURIComponent(event.title)}` : event.sourceUrl}
            target={isEditor ? undefined : "_blank"}
            rel={isEditor ? undefined : "noopener noreferrer"}
            className="timeline-content__link"
          >
            <span>{isEditor ? "View release notes" : "View source"}</span>
            <Icon name="external-link" size={12} />
          </a>
        </div>
      </div>
    );
  }

  // Ingestion Job Card
  const hasCreated = event.recordsCreated > 0;
  const hasUpdated = event.recordsUpdated > 0;
  const hasDeleted = event.recordsDeleted > 0;
  const hasChanges = hasCreated || hasUpdated || hasDeleted;

  return (
    <div className="timeline-content timeline-content--ingestion">
      <h2 className="timeline-content__title">
        Scraper Job: <code>{event.jobName}</code>
      </h2>
      <p className="timeline-content__meta">
        Source: <code>{event.sourceType}</code> · Status:{" "}
        <span className={`timeline-status-badge timeline-status-badge--${event.status}`}>
          {event.status}
        </span>
      </p>

      {event.status === "failed" && event.errorMessage ? (
        <div className="timeline-content__error">
          <p className="timeline-content__error-header">
            <Icon name="alert-triangle" size={12} /> Ingestion failed
          </p>
          <pre>{event.errorMessage}</pre>
        </div>
      ) : (
        <div className="timeline-content__stats">
          {hasChanges ? (
            <div className="timeline-content__changes-group">
              <ul className="timeline-stats-list">
                {hasCreated && (
                  <li>
                    <span className="timeline-stats-count timeline-stats-count--created">
                      +{event.recordsCreated}
                    </span>{" "}
                    created
                  </li>
                )}
                {hasUpdated && (
                  <li>
                    <span className="timeline-stats-count timeline-stats-count--updated">
                      ~{event.recordsUpdated}
                    </span>{" "}
                    updated
                  </li>
                )}
                {hasDeleted && (
                  <li>
                    <span className="timeline-stats-count timeline-stats-count--deleted">
                      -{event.recordsDeleted}
                    </span>{" "}
                    deleted
                  </li>
                )}
              </ul>

              {event.updates && event.updates.length > 0 && (
                <div className="timeline-content__run-updates">
                  <p className="timeline-run-updates-header">Imported updates:</p>
                  <ul className="timeline-run-updates-list">
                    {event.updates.map((update) => {
                      const isEditor = update.eventType === "unity_release";
                      const isPackage = update.eventType === "package_version";
                      
                      let href = update.sourceUrl;
                      let target: string | undefined = "_blank";
                      
                      if (isEditor) {
                        href = `/releases/${encodeURIComponent(update.title)}`;
                        target = undefined;
                      } else if (isPackage) {
                        href = `/packages?q=${encodeURIComponent(update.title.split(" ")[0] || "")}`;
                        target = undefined;
                      }
                      
                      return (
                        <li key={update.id}>
                          <span className={`chip chip--small chip--event-${update.eventType}`}>
                            {update.eventType === "unity_release" ? "editor" : update.eventType === "package_version" ? "package" : "news"}
                          </span>
                          <a href={href} target={target} rel={target ? "noopener noreferrer" : undefined}>
                            {update.title}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="timeline-content__no-changes">
              No new datasets were added or changed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function safeListTimelineFeed(): Promise<TimelineEvent[]> {
  try {
    return await listTimelineFeed(200);
  } catch (err) {
    console.error("Failed to load timeline feed:", err);
    return [];
  }
}
