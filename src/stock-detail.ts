import { examples, type ExamplePhoto } from "./examples.ts";
import { lineChart, type Series } from "./line-chart.ts";
import { escapeHtml } from "./stock-list.ts";
import type { Columns, Stock, StockSummary } from "./types.ts";

// Layers are red-, green- and blue-sensitive; they form cyan, magenta and yellow dyes.
const LAYER_COLORS = ["#d64541", "#2e9e5b", "#3b6fd6"];
const DYE_COLORS = ["#1aa3b8", "#c2398f", "#d9a400"];
const BW_COLOR = "#777";
// How far below the peak a sensitivity curve is drawn; datasheets show about 3 log units.
const SENSITIVITY_RANGE_LOG = 3.5;
const SOURCE_NOTES: Record<StockSummary["source"], string> = {
  spektrafilm: "Profile from spektrafilm by Andrea Volpato, built from manufacturer data.",
  Negs: "Profile prepared by Negs from the manufacturer's datasheet, with spektrafilm's method.",
  Fotufilm: "Profile from Fotufilm by MUAStudio, converted for Negs.",
};
const LICENCE_FILE: Record<StockSummary["source"], string> = {
  spektrafilm: "SPEKTRAFILM_LICENSE.txt",
  Negs: "SPEKTRAFILM_LICENSE.txt",
  Fotufilm: "FOTUFILM_LICENSE.txt",
};

export function stockDetail(stock: Stock, stocks: StockSummary[], photos: ExamplePhoto[]): string {
  const targetPrint = stocks.find((candidate) => candidate.id === stock.targetPrint);
  const facts: [string, string][] = [
    ["Manufacturer", escapeHtml(stock.manufacturer)],
    ["Kind", stock.kind + (stock.isBlackAndWhite ? ", black and white" : "")],
    [
      "Prints on",
      targetPrint ? `<a href="#/${targetPrint.id}">${escapeHtml(targetPrint.name)}</a>` : "-",
    ],
    ["Measured under", escapeHtml(stock.referenceIlluminant ?? "-")],
    ["Densitometer", escapeHtml(stock.densitometer ?? "-")],
    ["Profile id", `<code>${stock.id}</code>`],
  ];

  return `<article class="stock">
  <header>
    <p class="eyebrow">${stock.kind}</p>
    <h1>${escapeHtml(stock.name)}</h1>
    ${datasheetButton(stock)}
  </header>
  <dl class="facts">${facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")}</dl>
  <div class="charts">${charts(stock)}</div>
  ${examples(stock.id, stock.name, stock.kind === "Print paper", photos)}
  <footer class="credit">
    <p>${SOURCE_NOTES[stock.source]}</p>
    <p>${escapeHtml(stock.credit)}</p>
    <p>${escapeHtml(stock.license)} <a href="data/licenses/${LICENCE_FILE[stock.source]}">Licence and notices</a></p>
  </footer>
</article>`;
}

function datasheetButton(stock: Stock): string {
  if (!stock.datasheet) return `<p class="no-datasheet">No datasheet found for this stock.</p>`;
  // Manufacturer sheets are copyrighted, so the site links to where they are already hosted.
  const host = new URL(stock.datasheet.url).hostname.replace(/^www\./, "");
  return `<a class="button" href="${escapeHtml(stock.datasheet.url)}" target="_blank" rel="noopener">
    Download the original datasheet (PDF)</a>
    <p class="datasheet-note">${escapeHtml(stock.datasheet.title)}. Hosted by ${escapeHtml(host)}, not by this site.</p>`;
}

/**
 * Profiles store sensitivity in spektrafilm's own relative units (about 3 log units below a Kodak
 * datasheet) and extrapolate the tails far past the measured range. Datasheets plot only the top
 * few log units, so shift the peak to 0 and end each curve once it falls that far below.
 */
function datasheetView(series: Series[]): Series[] {
  const peak = Math.max(
    ...series.flatMap((line) => line.values).filter((v): v is number => v !== null),
  );
  return series.map((line) => ({
    ...line,
    values: line.values.map((value) =>
      value === null || value - peak < -SENSITIVITY_RANGE_LOG ? null : value - peak,
    ),
  }));
}

/**
 * Profile curves start at 0; datasheet curves start at the film base, read with the stock's
 * densitometer (Status M for negatives). Adding the derived base makes them line up.
 */
function withBase(series: Series[], densityMinimum: number[] | null): Series[] {
  if (!densityMinimum) return series;
  return series.map((line, channel) => ({
    ...line,
    values: line.values.map((value) => (value === null ? null : value + densityMinimum[channel])),
  }));
}

function charts(stock: Stock): string {
  const isBw = stock.logSensitivity[0]?.length === 1;
  const layers = (columns: Columns, names: string[], colors: string[]): Series[] =>
    names.map((label, column) => ({
      label,
      color: colors[column],
      values: columns.map((row) => row[column] ?? null),
    }));
  const layerNames = isBw
    ? ["Silver"]
    : ["Red-sensitive layer", "Green-sensitive layer", "Blue-sensitive layer"];
  const layerColors = isBw ? [BW_COLOR] : LAYER_COLORS;
  const dyeSeries = layers(
    stock.channelDensity,
    isBw ? ["Silver"] : ["Cyan dye", "Magenta dye", "Yellow dye"],
    isBw ? [BW_COLOR] : DYE_COLORS,
  );
  if (stock.baseDensity)
    dyeSeries.push({ label: "Base", color: "#999", values: stock.baseDensity, isDashed: true });
  if (stock.midscaleNeutralDensity) {
    dyeSeries.push({
      label: "Mid-grey",
      color: "#555",
      values: stock.midscaleNeutralDensity,
      isDashed: true,
    });
  }

  return [
    lineChart({
      title: "Spectral sensitivity",
      xLabel: "Wavelength (nm)",
      yLabel: "Log sensitivity (peak = 0)",
      x: stock.wavelengths,
      series: datasheetView(layers(stock.logSensitivity, layerNames, layerColors)),
    }),
    lineChart({
      title: "Characteristic curves",
      xLabel: "Log exposure (relative)",
      yLabel: stock.densityMinimum ? "Density (base added, derived)" : "Density above base",
      x: stock.logExposure,
      series: withBase(layers(stock.densityCurves, layerNames, layerColors), stock.densityMinimum),
    }),
    lineChart({
      title: "Spectral dye density",
      xLabel: "Wavelength (nm)",
      yLabel: "Density",
      x: stock.wavelengths,
      series: dyeSeries,
    }),
  ].join("");
}
