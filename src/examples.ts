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
 * A before/after slider per example photo rendered through this stock: drag to reveal the film.
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

  const sliders = shown
    .map((photo) => {
      const credit = `<a href="${escapeHtml(photo.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(photo.credit)}</a>`;
      const license = `<a href="${escapeHtml(photo.licenseUrl)}" target="_blank" rel="noopener">${escapeHtml(photo.license)}</a>`;
      return `<figure class="example">
  <div class="compare">
    <img src="examples/${photo.id}/original.jpg" alt="${escapeHtml(photo.title)}, original" loading="lazy">
    <img class="compare-film" src="examples/${photo.id}/${stockId}.jpg" alt="${escapeHtml(`${photo.title} on ${stockName}`)}" loading="lazy">
    <input class="compare-range" type="range" min="0" max="100" value="50" aria-label="Compare original with ${escapeHtml(stockName)}">
  </div>
  <div class="compare-sides"><span>Original</span><span>${escapeHtml(stockName)}</span></div>
  <figcaption>${escapeHtml(photo.title)}, ${escapeHtml(photo.camera)}. By ${credit}, ${license}</figcaption>
</figure>`;
    })
    .join("");

  return `<section class="examples">
  <h2>Examples</h2>
  <p class="muted">Raw photos rendered through this stock by the Negs engine with spektrafilm's model and automatic exposure.
  The original is a neutral rendering of the same raw at the same exposure. Drag across a photo to compare.${isPaper ? " This paper is shown printing Kodak Portra 400." : ""}</p>
  <div class="example-grid">${sliders}</div>
</section>`;
}
