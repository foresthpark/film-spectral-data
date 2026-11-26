import "./style.css";
import type { ExamplePhoto } from "./examples.ts";
import { stockDetail } from "./stock-detail.ts";
import { stockList } from "./stock-list.ts";
import type { Stock, StockSummary } from "./types.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<aside class="sidebar">
  <a class="site-title" href="#/">Film spectral data</a>
  <input class="search" type="search" placeholder="Search stocks" aria-label="Search stocks">
  <nav class="stock-nav"></nav>
</aside>
<main class="content"></main>`;
const search = app.querySelector<HTMLInputElement>(".search")!;
const nav = app.querySelector<HTMLElement>(".stock-nav")!;
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
    content.innerHTML = welcome();
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
  return `<article class="welcome">
  <h1>Film spectral data</h1>
  <p>Spectral sensitivity, characteristic curves and dye densities for ${stocks.length} film and paper stocks
  (${counts}). Pick a stock to see its data and get the manufacturer's original datasheet.</p>
  <p class="muted">The profiles are licensed under CC BY-SA 4.0. Each stock page credits who made it.</p>
</article>`;
}

search.addEventListener("input", renderNav);
window.addEventListener("hashchange", () => {
  renderNav();
  void renderContent();
});
renderNav();
await renderContent();
