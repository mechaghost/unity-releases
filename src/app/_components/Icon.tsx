import type { SVGProps } from "react";

export type IconName =
  | "chevron-right"
  | "chevron-down"
  | "search"
  | "filter"
  | "x"
  | "external-link"
  | "package"
  | "sparkles"
  | "calendar"
  | "alert-triangle"
  | "alert-octagon"
  | "info"
  | "sun"
  | "moon"
  | "menu"
  | "arrow-right"
  | "arrows-left-right"
  | "check"
  | "rss"
  | "home"
  | "rocket"
  | "newspaper"
  | "git-compare"
  | "file-text";

const PATHS: Record<IconName, string> = {
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm10 2l-4.35-4.35",
  filter: "M3 6h18M6 12h12M10 18h4",
  x: "M18 6L6 18M6 6l12 12",
  "external-link": "M15 3h6v6 M10 14L21 3 M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5",
  package: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  sparkles: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z M19 13l.7 2.1L22 16l-2.3.9L19 19l-.7-2.1L16 16l2.3-.9z M5 14l.7 2.1L8 17l-2.3.9L5 20l-.7-2.1L2 17l2.3-.9z",
  calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18",
  "alert-triangle": "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  "alert-octagon": "M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z M12 8v4 M12 16h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  "arrow-right": "M5 12h14 M12 5l7 7-7 7",
  "arrows-left-right": "M8 3L4 7l4 4 M4 7h16 M16 21l4-4-4-4 M20 17H4",
  check: "M20 6L9 17l-5-5",
  rss: "M4 11a9 9 0 0 1 9 9 M4 4a16 16 0 0 1 16 16 M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  home: "M3 12L12 3l9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10",
  rocket: "M5 13l4 4L20 6 M5 13L3 21l8-2 M14 8l3-3 M9 16l-2 2",
  newspaper: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2 M18 14h-8 M15 18h-5 M10 6h8v4h-8z",
  "git-compare": "M6 6m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M18 18m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M13 6h3a2 2 0 0 1 2 2v7 M11 18H8a2 2 0 0 1-2-2V9",
  "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"
};

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 16, ...rest }: IconProps) {
  const d = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {d.split(" M").map((segment, idx) => (
        <path key={idx} d={idx === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}
