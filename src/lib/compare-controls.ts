export type CompareLaneState = {
  id: string;
  defaultOpen: boolean;
};

type CompareUrlInput = {
  fromVersion: string;
  toVersion: string;
  platform: string;
  expanded: ReadonlySet<string>;
  topicFilter: ReadonlySet<string>;
  hash?: string;
};

type CompareLaneInput = Omit<CompareUrlInput, "hash"> & {
  lane: CompareLaneState;
};

type CompareTopicInput = Omit<CompareUrlInput, "hash"> & {
  laneId: string;
};

export function compareControlUrl(input: CompareUrlInput) {
  const params = new URLSearchParams();
  params.set("from", input.fromVersion);
  params.set("to", input.toVersion);
  if (input.platform) params.set("platform", input.platform);
  if (input.expanded.size > 0) params.set("expand", Array.from(input.expanded).join(","));
  if (input.topicFilter.size > 0) params.set("topics", Array.from(input.topicFilter).join(","));
  return `/compare?${params.toString()}${input.hash ? `#${input.hash}` : ""}`;
}

export function toggleCompareLaneOpenUrl(input: CompareLaneInput) {
  const expanded = new Set(input.expanded);
  if (isCompareLaneOpen(input.lane, expanded)) {
    expanded.delete(input.lane.id);
    if (input.lane.defaultOpen) expanded.add(`!${input.lane.id}`);
  } else {
    expanded.delete(`!${input.lane.id}`);
    expanded.add(input.lane.id);
  }

  return compareControlUrl({
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    platform: input.platform,
    expanded,
    topicFilter: input.topicFilter
  });
}

export function toggleCompareTopicUrl(input: CompareTopicInput) {
  const topicFilter = new Set(input.topicFilter);
  if (topicFilter.has(input.laneId)) {
    topicFilter.delete(input.laneId);
  } else {
    topicFilter.add(input.laneId);
  }

  return compareControlUrl({
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    platform: input.platform,
    expanded: input.expanded,
    topicFilter
  });
}

export function isCompareLaneOpen(def: CompareLaneState, expanded: ReadonlySet<string>) {
  return expanded.has(def.id) || (def.defaultOpen && !expanded.has(`!${def.id}`));
}
