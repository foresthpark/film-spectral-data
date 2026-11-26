import type { ExamplePhoto } from "./examples.ts";
import { BW_TAG, escapeHtml, groupStocks, noMatches } from "./stock-list.ts";
import type { StockSummary } from "./types.ts";

/** The home page: every stock as a thumbnail of the same photo, so stocks compare at a glance. */
export function stockGrid(stocks: StockSummary[], query: string, photos: ExamplePhoto[]): string {
  const groups = groupStocks(stocks, query);
  if (groups.length === 0) return noMatches(query);
  // ponytail: full 1200px renders as thumbnails (~130 kB each, lazy). Add small renders in
  // scripts/render-examples.py if the home page gets slow.
  const photo = photos[0];

  return groups
    .map(({ kind, stocks: group }) => {
      const cards = group
        .map((stock) => {
          const thumbnail = photo?.stocks.includes(stock.id)
            ? `<img src="examples/${photo.id}/${stock.id}.jpg" alt="" loading="lazy">`
            : `<div class="thumb-empty"></div>`;
          const tag = stock.isBlackAndWhite ? BW_TAG : "";
          return `<li><a class="stock-card" href="#/${stock.id}">${thumbnail}<span class="stock-card-name"><span>${escapeHtml(stock.name)}</span>${tag}</span></a></li>`;
        })
        .join("");
      return `<section class="grid-group"><h2>${kind} <span class="count">${group.length}</span></h2><ul class="stock-grid">${cards}</ul></section>`;
    })
    .join("");
}
