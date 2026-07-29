export type ProductUpdatePresentationItem = {
  itemKey: string;
  section: string;
  changeKind: string;
  body: string;
  platforms: string[];
  tags: string[];
  sourceOrder: number;
};

export type ProductUpdateItemGroup = {
  id: string;
  section: string;
  items: Array<ProductUpdatePresentationItem & { platforms: string[] }>;
  emptyMessage: string | null;
};

export function groupProductUpdateItems(
  items: ProductUpdatePresentationItem[],
  releaseSummary: string
) {
  const groups: ProductUpdateItemGroup[] = [];
  const groupsBySection = new Map<string, ProductUpdateItemGroup>();
  const platformContext = new Map<string, string[]>();

  for (const item of items) {
    const sectionKey = normalizeProductUpdateValue(item.section);
    let group = groupsBySection.get(sectionKey);
    if (!group) {
      group = {
        id: `${productUpdateClassName(item.section)}-${groups.length}`,
        section: item.section,
        items: [],
        emptyMessage: null
      };
      groups.push(group);
      groupsBySection.set(sectionKey, group);
    }

    if (sameProductUpdateText(item.body, releaseSummary)) continue;
    if (isEmptyProductUpdateItem(item.body)) {
      group.emptyMessage = emptyProductUpdateSectionMessage(item.section);
      continue;
    }
    if (isPlatformContextItem(item)) {
      platformContext.set(sectionKey, item.platforms);
      continue;
    }

    group.items.push({
      ...item,
      platforms: uniqueProductUpdateValues([
        ...(platformContext.get(sectionKey) ?? []),
        ...item.platforms
      ])
    });
  }

  return groups.filter(
    (group) => group.items.length > 0 || group.emptyMessage !== null
  );
}

export function humanizeProductUpdateValue(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

export function productUpdateClassName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isPlatformContextItem(item: ProductUpdatePresentationItem) {
  if (item.platforms.length === 0) return false;
  const namedPlatforms = new Set(
    item.platforms.map((platform) => normalizeProductUpdateValue(platform))
  );
  const bodyParts = item.body
    .split(/,|\/|&|\band\b/i)
    .map((part) => normalizeProductUpdateValue(part))
    .filter(Boolean);
  return (
    bodyParts.length > 0 &&
    bodyParts.every((part) => namedPlatforms.has(part))
  );
}

function isEmptyProductUpdateItem(value: string) {
  return /^(?:none|n\/a|not applicable|no changes?)[.!]?$/i.test(value.trim());
}

function emptyProductUpdateSectionMessage(section: string) {
  const normalized = normalizeProductUpdateValue(section);
  if (normalized.includes("known issue")) return "No known issues reported.";
  if (normalized.includes("public api")) {
    return "No public API changes reported.";
  }
  return "No changes reported for this section.";
}

function sameProductUpdateText(left: string, right: string) {
  return (
    normalizeProductUpdateValue(left) !== "" &&
    normalizeProductUpdateValue(left) === normalizeProductUpdateValue(right)
  );
}

function uniqueProductUpdateValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeProductUpdateValue(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizeProductUpdateValue(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
