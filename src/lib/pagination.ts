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
