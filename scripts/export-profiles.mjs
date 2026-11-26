// Exports film profiles (spektrafilm format) into public/data for the site.
// Usage: vp run export-data, or vp node scripts/export-profiles.mjs [DATA_DIR]
// DATA_DIR holds profiles/*.json and the licence texts; default: the Negs data folder pinned in the plugin repo.
// The profiles are CC BY-SA 4.0: every exported stock keeps its credit and licence text.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const dataDir = process.argv[2] ?? "../spektrafilm-c1-plugin/vendor/negs/data";
const outDir = "public/data";
const LICENCE_FILES = ["SPEKTRAFILM_LICENSE.txt", "FOTUFILM_LICENSE.txt"];
const SIGNIFICANT_DIGITS = 5;
// Densitometer responsivities shipped in the Negs data folder (Giorgianni, Madden and Kriss, Digital Color Management).
const DENSITOMETERS = {
  status_M: "profile-sources/kodak-e190/densitometer/status_M",
  status_A: "profile-sources/fujifilm-print/densitometer/status_A",
};

const datasheets = JSON.parse(readFileSync("data/datasheets.json", "utf8"));

function round(values) {
  if (Array.isArray(values)) return values.map(round);
  return typeof values === "number" ? Number(values.toPrecision(SIGNIFICANT_DIGITS)) : values;
}

/** Who prepared the profile, from its own metadata (the same rule the Negs engine uses). */
function sourceOf(metadata) {
  const version = metadata.version ?? "";
  if (version.startsWith("negs")) return "Negs";
  if (version.startsWith("fotufilm")) return "Fotufilm";
  return "spektrafilm";
}

function readResponsivity(folder) {
  return ["r", "g", "b"].map((channel) =>
    readFileSync(join(dataDir, folder, `responsivity_${channel}.csv`), "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split(",").map(Number)),
  );
}
const responsivities = Object.fromEntries(
  Object.entries(DENSITOMETERS).map(([name, folder]) => [name, readResponsivity(folder)]),
);

function interpolate(points, x) {
  if (x < points[0][0] || x > points[points.length - 1][0]) return 0;
  const i = points.findIndex(([px]) => px >= x);
  if (i === 0) return points[0][1];
  const [[x0, y0], [x1, y1]] = [points[i - 1], points[i]];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * The base's density as the stock's densitometer reads it, per channel: what a datasheet's
 * characteristic curves start from. Derived from the profile's base spectrum, not measured.
 */
function densityMinimum(info, data) {
  const channels = responsivities[info.densitometer];
  if (!channels || !data.base_density || info.channel_model === "bw") return null;
  return channels.map((points) => {
    let weighted = 0;
    let total = 0;
    data.wavelengths.forEach((wavelength, i) => {
      const base = data.base_density[i];
      if (base === null) return;
      const response = interpolate(points, wavelength);
      weighted += response * 10 ** -base;
      total += response;
    });
    return Number((-Math.log10(weighted / total)).toFixed(3));
  });
}

function kindOf(info) {
  if (info.support === "paper") return "Print paper";
  if (info.type === "positive") return "Slide";
  return info.use === "cine" ? "Cine negative" : "Negative";
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "stocks"), { recursive: true });
mkdirSync(join(outDir, "licenses"), { recursive: true });

const index = [];
for (const file of readdirSync(join(dataDir, "profiles"))
  .filter((name) => name.endsWith(".json"))
  .sort()) {
  const {
    info,
    data,
    metadata = {},
  } = JSON.parse(readFileSync(join(dataDir, "profiles", file), "utf8"));
  const id = info.stock;
  const summary = {
    id,
    name: info.name,
    manufacturer: info.name.split(" ")[0],
    kind: kindOf(info),
    isBlackAndWhite: info.channel_model === "bw",
    source: sourceOf(metadata),
    targetPrint: info.target_print ?? null,
    datasheet: datasheets[id] ?? null,
  };
  index.push(summary);
  const stock = {
    ...summary,
    credit: metadata.copyright ?? "",
    license: metadata.license ?? "",
    dataSource: metadata.datasource ?? "",
    referenceIlluminant: info.reference_illuminant ?? null,
    densitometer: info.densitometer ?? null,
    densityMinimum: densityMinimum(info, data),
    wavelengths: round(data.wavelengths),
    logSensitivity: round(data.log_sensitivity),
    channelDensity: round(data.channel_density),
    baseDensity: round(data.base_density),
    midscaleNeutralDensity: round(data.midscale_neutral_density ?? null),
    logExposure: round(data.log_exposure),
    densityCurves: round(data.density_curves),
  };
  writeFileSync(join(outDir, "stocks", `${id}.json`), JSON.stringify(stock));
}
writeFileSync(join(outDir, "index.json"), JSON.stringify(index));

for (const name of LICENCE_FILES) {
  if (existsSync(join(dataDir, name)))
    copyFileSync(join(dataDir, name), join(outDir, "licenses", name));
}

const missing = index.filter((stock) => !stock.datasheet).map((stock) => stock.id);
console.log(
  `exported ${index.length} stocks to ${outDir}; ${missing.length} without a datasheet link`,
);
const unknown = Object.keys(datasheets).filter((id) => !index.some((stock) => stock.id === id));
if (unknown.length) console.warn("datasheets.json has unknown ids:", unknown.join(", "));
