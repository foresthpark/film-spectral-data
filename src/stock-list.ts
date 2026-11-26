import type { Kind, StockSummary } from "./types.ts";

const KIND_ORDER: Kind[] = ["Negative", "Slide", "Cine negative", "Print paper"];

/** The sidebar: stocks grouped by kind, filtered by the search text. */
export function stockList(
  stocks: StockSummary[],
  query: string,
  selectedId: string | null,
): string {
  const matching = stocks.filter((stock) =>
    `${stock.name} ${stock.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (matching.length === 0) return `<p class="empty">No stocks match “${escapeHtml(query)}”.</p>`;

  return KIND_ORDER.map((kind) => {
    const group = matching
      .filter((stock) => stock.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (group.length === 0) return "";
    const items = group
      .map((stock) => {
        const current = stock.id === selectedId ? ' aria-current="page"' : "";
        const tag = stock.isBlackAndWhite ? '<span class="tag">B&amp;W</span>' : "";
        return `<li><a href="#/${stock.id}"${current}>${escapeHtml(stock.name)}${tag}</a></li>`;
      })
      .join("");
    return `<section><h2>${kind} <span class="count">${group.length}</span></h2><ul>${items}</ul></section>`;
  }).join("");
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
}
