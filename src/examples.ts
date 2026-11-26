import { escapeHtml } from "./stock-list.ts";

/** Written by scripts/render-examples.py. */
export interface ExamplePhoto {
  id: string;
  title: string;
  camera: string;
  credit: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  exposureEV?: number;
  stocks: string[];
}

/**
 * Original and film side by side for each example photo rendered through this stock.
 * Papers can't be shown alone, so render-examples.py prints Kodak Portra 400 onto them.
 */
export function examples(
  stockId: string,
  stockName: string,
  isPaper: boolean,
  photos: ExamplePhoto[],
): string {
  const shown = photos.filter((photo) => photo.stocks.includes(stockId));
  if (shown.length === 0) return "";

  const pairs = shown
    .map((photo) => {
      const credit = `<a href="${escapeHtml(photo.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(photo.credit)}</a>`;
      const license = `<a href="${escapeHtml(photo.licenseUrl)}" target="_blank" rel="noopener">${escapeHtml(photo.license)}</a>`;
      return `<figure class="example">
  <div class="example-pair">
    ${picture(`examples/${photo.id}/original.jpg`, "Original", `${photo.title}, original`)}
    ${picture(`examples/${photo.id}/${stockId}.jpg`, stockName, `${photo.title} on ${stockName}`)}
  </div>
  <figcaption>${escapeHtml(photo.title)} · ${escapeHtml(photo.camera)} · by ${credit} · ${license}</figcaption>
</figure>`;
    })
    .join("");

  return `<section class="examples">
  <h2>Examples</h2>
  <p class="muted">Raw photos rendered through this stock by the Negs engine with spektrafilm's model and automatic exposure.
  The original is a neutral rendering of the same raw at the same exposure.${isPaper ? " This paper is shown printing Kodak Portra 400." : ""}</p>
  ${pairs}
</section>`;
}

function picture(src: string, label: string, alt: string): string {
  return `<div class="example-image">
    <img src="${src}" alt="${escapeHtml(alt)}" loading="lazy">
    <span class="example-label">${escapeHtml(label)}</span>
  </div>`;
}
