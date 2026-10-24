/** Preserve comparison bookmarks from before the release overview became home. */
export function legacyCompareHref(params: Record<string, string | string[] | undefined>): string | undefined {
  const intent = Object.keys(params).some(key => ["from", "to", "platform", "stream"].includes(key) || key.startsWith("p_"));
  if (!intent) return undefined;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  return `/compare?${query}`;
}
