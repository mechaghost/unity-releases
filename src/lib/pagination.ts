export type PaginationResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  start: number;
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export function paginateItems<T>(
  items: T[],
  requestedPage: string | number | null | undefined,
  pageSize: number
): PaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const parsedPage = parseRequestedPage(requestedPage);
  const page = Math.min(Math.max(parsedPage, 1), totalPages);
  const offset = (page - 1) * safePageSize;
  const pageItems = items.slice(offset, offset + safePageSize);

  return {
    items: pageItems,
    page,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    start: totalItems === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageItems.length, totalItems),
    hasPrev: page > 1,
    hasNext: page < totalPages
  };
}

function parseRequestedPage(raw: string | number | null | undefined): number {
  const value = typeof raw === "number" ? raw : raw ? Number(raw) : 1;
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export type QueryValues = Record<string, string | string[] | undefined>;

export function firstQueryValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
}

export function queryParams(values: QueryValues): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item);
    }
  }
  return params;
}

export function pageNumber(value: string | string[] | undefined): number {
  const raw = firstQueryValue(value);
  const page = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(page) && page > 0
    ? Math.min(page, 1_000_000) : 1;
}

export function pageBounds(total: number, requestedPage: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pages);
  return { page, pages, offset: (page - 1) * pageSize };
}

export function pageHref(path: string, params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.delete("offset");
  next.delete("page");
  if (page > 1) next.set("page", String(page));
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
