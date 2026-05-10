/**
 * Forge Library - Public API Barrel Export
 * 
 * Exports:
 * - 5 Classes: Project, CardType, Card, ReadonlyProject, IconCache
 * - 6 Utility Functions: escapeHtml, generateQrSvg, hashTagColor, parseCsv, generateCsv, remapHeaders
 * - All Type Definitions from types.ts
 */

// Classes
export { Project } from './project';
export { CardType } from './card-type';
export { Card } from './card';
export { ReadonlyProject } from './readonly-project';
export { IconCache } from './icon-cache';

// Utility Functions
export { validateVariableName } from './global-variables';
export { evaluateExpression, detectFontFormat, escapeCssFontName } from './template-renderer';
export { escapeHtml } from './utils/html';
export { generateQrSvg } from './utils/qr';
export { hashTagColor } from './utils/color';
export { parseCsv, generateCsv, remapHeaders } from './utils/csv';

// Type Definitions
export type {
  FieldType,
  ForgeField,
  ColorMapping,
  Aggregation,
  CardSize,
  ForgeCardType,
  ForgeRow,
  ForgeAsset,
  ForgeFont,
  TemplateData,
  RenderDeps,
  RenderOptions,
  RenderResult,
  ValidationResult,
  ProjectMeta,
  ForgeProject,
  CsvParseResult,
  IconQueueItem,
} from './types';
