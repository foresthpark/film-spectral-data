import "./style.css";
import type { ExamplePhoto } from "./examples.ts";
import { stockDetail } from "./stock-detail.ts";
import { stockGrid } from "./stock-grid.ts";
import { stockList } from "./stock-list.ts";
import type { Stock, StockSummary } from "./types.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<aside class="sidebar">
  <a class="site-title" href="#/">Film spectral data</a>
  <input class="search" type="search" placeholder="Search stocks" aria-label="Search stocks">
  <details class="browse">
    <summary>Browse all stocks</summary>
    <nav class="stock-nav"></nav>
  </details>
</aside>
<main class="content"></main>`;
const search = app.querySelector<HTMLInputElement>(".search")!;
const nav = app.querySelector<HTMLElement>(".stock-nav")!;
const browse = app.querySelector<HTMLDetailsElement>(".browse")!;
// Matches the mobile breakpoint in style.css. On phones the list folds away so the stock shows first.
const phone = matchMedia("(max-width: 760px)");
const content = app.querySelector<HTMLElement>(".content")!;

const stocks: StockSummary[] = await fetch("data/index.json").then((response) => response.json());
// Example renders are optional: the site still works before scripts/render-examples.py has run.
const photos: ExamplePhoto[] = await fetch("examples/index.json")
  .then((response) => (response.ok ? response.json() : []))
  .catch(() => []);
const loaded = new Map<string, Stock>();

function selectedId(): string | null {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  return stocks.some((stock) => stock.id === id) ? id : null;
}

function renderNav() {
  nav.innerHTML = stockList(stocks, search.value, selectedId());
}

async function renderContent() {
  const id = selectedId();
  if (!id) {
    content.innerHTML = welcome() + stockGrid(stocks, search.value, photos);
    document.title = "Film spectral data";
    return;
  }
  const stock: Stock =
    loaded.get(id) ?? (await fetch(`data/stocks/${id}.json`).then((response) => response.json()));
  loaded.set(id, stock);
  // A newer click may have landed while this one loaded.
  if (selectedId() !== id) return;
  content.innerHTML = stockDetail(stock, stocks, photos);
  document.title = `${stock.name} · Film spectral data`;
}

function welcome(): string {
  const counts = (["spektrafilm", "Negs", "Fotufilm"] as const)
    .map((source) => `${stocks.filter((stock) => stock.source === source).length} from ${source}`)
    .join(", ");
  return `<header class="welcome">
  <h1>Film spectral data</h1>
  <p>Spectral sensitivity, characteristic curves and dye densities for ${stocks.length} film and paper stocks
  (${counts}). Each is shown below on the same photo. Pick one for its data and original datasheet.</p>
  <p class="muted">The profiles are licensed under CC BY-SA 4.0. Each stock page credits who made it.</p>
</header>`;
}

function syncBrowse() {
  browse.open = !phone.matches;
}

search.addEventListener("input", () => {
  renderNav();
  if (selectedId()) {
    if (phone.matches) browse.open = true;
  } else {
    void renderContent();
  }
});
window.addEventListener("hashchange", () => {
  syncBrowse();
  renderNav();
  void renderContent();
});
phone.addEventListener("change", syncBrowse);
// Before/after sliders: the range input moves the split between original and film.
content.addEventListener("input", (event) => {
  const range = event.target;
  if (!(range instanceof HTMLInputElement) || !range.matches(".compare-range")) return;
  range.closest<HTMLElement>(".compare")!.style.setProperty("--split", `${range.value}%`);
});
syncBrowse();
renderNav();
await renderContent();
