"use client";

import { useTransition, type FormEvent } from "react";
import { setStreamFilterAction } from "../_actions/stream-filter";
import type { StreamName } from "@/lib/stream-filter";

const OPTIONS: { value: StreamName; label: string }[] = [
  { value: "LTS", label: "LTS" },
  { value: "Update/Supported", label: "Update" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" }
];

type Props = {
  selected: StreamName[];
};

export function SidebarStreamFilter({ selected }: Props) {
  const [pending, startTransition] = useTransition();

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    startTransition(() => {
      setStreamFilterAction(new FormData(form));
    });
  }

  return (
    <form
      action={setStreamFilterAction}
      onChange={handleChange}
      className="sidebar-streams"
      aria-label="Filter releases by stream"
      data-pending={pending ? "true" : undefined}
    >
      <span className="sidebar-streams__label">Streams</span>
      <div className="sidebar-streams__options" role="group">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="sidebar-streams__opt">
            <input
              type="checkbox"
              name="streams"
              value={opt.value}
              defaultChecked={selected.includes(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </form>
  );
}
