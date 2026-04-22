import type { ForgeRow } from './types.ts';

export declare function renderFullCard(
  project: {
    cardTypes: unknown[];
    data: ForgeRow[];
    globalVariables: Record<string, string>;
    assets: Record<string, { data: string; type: string }>;
    fonts: Record<string, { data: string; type: string; family?: string }>;
  },
  cardTypeId: string,
  row: ForgeRow,
  options?: { side?: string },
): { html: string; css: string; width: string; height: string; cardTypeId: string } | null;

export declare function evaluateExpression(
  expression: string,
  data: Record<string, unknown>,
): number;

export declare function escapeHtml(str: string): string;

export declare function preprocessRow(
  row: ForgeRow,
  fields: unknown[],
  cardType: unknown,
  deps?: unknown,
): Record<string, unknown>;

export declare function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  deps?: unknown,
): string;

export declare function buildFontFaceCss(
  fonts: Record<string, { data: string; type: string; family?: string }>,
): string;

export declare function getAutoColorVars(
  row: ForgeRow,
  cardType: unknown,
  hashTagColorFn?: (v: string) => string,
): Record<string, string>;

export declare function preprocessCssAssets(
  css: string,
  getAssetFn?: (name: string) => { data: string; type: string } | null,
): string;

export declare function detectFontFormat(filename: string): string;
export declare function escapeCssFontName(name: string): string;
export declare function compileTemplate(templateStr: string): (data: Record<string, unknown>, deps?: unknown) => string;
export declare function validateComputedFields(fields: unknown[]): string[];
