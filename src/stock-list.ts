import type { Kind, StockSummary } from "./types.ts";

const KIND_ORDER: Kind[] = ["Negative", "Slide", "Cine negative", "Print paper"];

/** Stocks matching the search text, grouped by kind in display order, empty groups dropped. */
export function groupStocks(
  stocks: StockSummary[],
  query: string,
): { kind: Kind; stocks: StockSummary[] }[] {
  const matching = stocks.filter((stock) =>
    `${stock.name} ${stock.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return KIND_ORDER.map((kind) => ({
    kind,
    stocks: matching
      .filter((stock) => stock.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.stocks.length > 0);
}

export function noMatches(query: string): string {
  return `<p class="empty">No stocks match “${escapeHtml(query)}”.</p>`;
}

export const BW_TAG = '<span class="tag">B&amp;W</span>';

/** The sidebar: stocks grouped by kind, filtered by the search text. */
export function stockList(
  stocks: StockSummary[],
  query: string,
  selectedId: string | null,
): string {
  const groups = groupStocks(stocks, query);
  if (groups.length === 0) return noMatches(query);

  return groups
    .map(({ kind, stocks: group }) => {
      const items = group
        .map((stock) => {
          const current = stock.id === selectedId ? ' aria-current="page"' : "";
          const tag = stock.isBlackAndWhite ? BW_TAG : "";
          return `<li><a href="#/${stock.id}"${current}><span>${escapeHtml(stock.name)}</span>${tag}</a></li>`;
        })
        .join("");
      return `<section><h2>${kind} <span class="count">${group.length}</span></h2><ul>${items}</ul></section>`;
    })
    .join("");
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
}
