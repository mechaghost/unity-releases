import { pageHref } from "@/lib/pagination";

export function Pagination({ path, params, page, pages }: {
  path: string;
  params: URLSearchParams;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  return <nav className="lane__pagination" aria-label="Pagination">
    {page > 1 ? <a className="lane__pagination-btn" href={pageHref(path, params, page - 1)} rel="prev">Previous</a> : null}
    <span>Page {page.toLocaleString()} of {pages.toLocaleString()}</span>
    {page < pages ? <a className="lane__pagination-btn" href={pageHref(path, params, page + 1)} rel="next">Next</a> : null}
  </nav>;
}
