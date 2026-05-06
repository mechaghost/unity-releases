import type { ReactNode } from "react";

type ChipProps = {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Chip({ children, className, title }: ChipProps) {
  return (
    <span className={["chip", className].filter(Boolean).join(" ")} title={title}>
      {children}
    </span>
  );
}

export function CountChip({ count, label }: { count: number; label?: string }) {
  return (
    <span className="chip chip--count" title={label}>
      {count.toLocaleString()}
    </span>
  );
}
