"use client";

import { useEffect, useState } from "react";

export function LocalUpdatedTime({ timestamp }: { timestamp: string | null }) {
  const [localTime, setLocalTime] = useState<string | null>(null);
  useEffect(() => {
    setLocalTime(timestamp ? new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short"
    }).format(new Date(timestamp)) : null);
  }, [timestamp]);

  return <span className="guide-updated" title="Latest successful core data refresh">
    <span>Last updated</span>
    {timestamp ? <time dateTime={timestamp}>{localTime ?? `${timestamp.slice(0, 16).replace("T", " ")} UTC`}</time>
      : <span>Unavailable</span>}
  </span>;
}
