/** Written by scripts/export-profiles.mjs. */
export type Kind = "Negative" | "Cine negative" | "Slide" | "Print paper";

export interface Datasheet {
  url: string;
  title: string;
}

export interface StockSummary {
  id: string;
  name: string;
  manufacturer: string;
  kind: Kind;
  isBlackAndWhite: boolean;
  source: "spektrafilm" | "Negs" | "Fotufilm";
  targetPrint: string | null;
  datasheet: Datasheet | null;
}

/** Per-wavelength or per-exposure rows; one column per layer (three for colour, one for B&W). null is no data. */
export type Columns = (number | null)[][];

export interface Stock extends StockSummary {
  credit: string;
  license: string;
  dataSource: string;
  referenceIlluminant: string | null;
  densitometer: string | null;
  /** Base density per channel as the densitometer reads it, derived from baseDensity. null if unknown. */
  densityMinimum: number[] | null;
  wavelengths: number[];
  logSensitivity: Columns;
  channelDensity: Columns;
  baseDensity: (number | null)[] | null;
  midscaleNeutralDensity: (number | null)[] | null;
  logExposure: number[];
  densityCurves: Columns;
}
