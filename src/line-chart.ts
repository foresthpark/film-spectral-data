/** A small SVG line chart. Gaps (null) break the line instead of dropping to zero. */
export interface Series {
  label: string;
  color: string;
  values: (number | null)[];
  isDashed?: boolean;
}

interface LineChartOptions {
  title: string;
  xLabel: string;
  yLabel: string;
  x: number[];
  series: Series[];
}

const WIDTH = 520;
const HEIGHT = 300;
const MARGIN = { top: 16, right: 16, bottom: 44, left: 52 };
const TICK_COUNT = 5;

export function lineChart({ title, xLabel, yLabel, x, series }: LineChartOptions): string {
  const ys = series
    .flatMap((line) => line.values)
    .filter((value): value is number => value !== null);
  const [xMin, xMax] = [Math.min(...x), Math.max(...x)];
  const yTicks = niceTicks(Math.min(...ys), Math.max(...ys));
  const [yMin, yMax] = [yTicks[0], yTicks[yTicks.length - 1]];
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const toX = (value: number) => MARGIN.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const toY = (value: number) =>
    MARGIN.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotHeight;

  const lines = series
    .map((line) => {
      const path = line.values
        .map((value, i) =>
          value === null
            ? ""
            : `${i === 0 || line.values[i - 1] === null ? "M" : "L"}${toX(x[i]).toFixed(1)},${toY(value).toFixed(1)}`,
        )
        .join("");
      const dash = line.isDashed ? ' stroke-dasharray="5 4"' : "";
      return `<path d="${path}" fill="none" stroke="${line.color}" stroke-width="2"${dash}><title>${line.label}</title></path>`;
    })
    .join("");
  const xTicks = niceTicks(xMin, xMax).filter((tick) => tick >= xMin && tick <= xMax);
  const grid = [
    ...yTicks.map(
      (tick) =>
        `<line class="grid" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${toY(tick)}" y2="${toY(tick)}"/>` +
        `<text class="tick" x="${MARGIN.left - 8}" y="${toY(tick) + 4}" text-anchor="end">${format(tick)}</text>`,
    ),
    ...xTicks.map(
      (tick) =>
        `<text class="tick" x="${toX(tick)}" y="${HEIGHT - MARGIN.bottom + 18}" text-anchor="middle">${format(tick)}</text>`,
    ),
  ].join("");
  const legend = series
    .map(
      (line) =>
        `<span class="legend-item"><i style="background:${line.color}"></i>${line.label}</span>`,
    )
    .join("");

  return `<figure class="chart">
  <figcaption>${title}</figcaption>
  <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${title}">
    ${grid}${lines}
    <text class="axis-label" x="${MARGIN.left + plotWidth / 2}" y="${HEIGHT - 6}" text-anchor="middle">${xLabel}</text>
    <text class="axis-label" transform="rotate(-90)" x="${-(MARGIN.top + plotHeight / 2)}" y="14" text-anchor="middle">${yLabel}</text>
  </svg>
  <div class="legend">${legend}</div>
</figure>`;
}

function niceTicks(min: number, max: number): number[] {
  const span = max - min || 1;
  const rawStep = span / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * magnitude)
      .find((candidate) => candidate >= rawStep) ?? rawStep;
  const ticks: number[] = [];
  for (let tick = Math.floor(min / step) * step; tick <= max + step * 0.999; tick += step)
    ticks.push(Number(tick.toPrecision(10)));
  return ticks;
}

function format(value: number): string {
  return Math.abs(value) >= 100 ? value.toFixed(0) : Number(value.toFixed(2)).toString();
}
