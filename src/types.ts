/**
 * Forge Domain Types
 * TypeScript interfaces matching the existing JS data shapes.
 * Source of truth: JSDoc typedefs in template-renderer.js, project-format.js, and card-type-registry-core.js
 */

/**
 * Valid field types for card fields.
 * Matches VALID_FIELD_TYPES from card-type-registry-core.js
 */
export type FieldType =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'tags'
  | 'url'
  | 'image'
  | 'number'
  | 'icon'
  | 'qr'
  | 'text-long'
  | 'richtext'
  | 'background'
  | 'pdf'
  | 'computed';

/**
 * A single field definition in a card type.
 * From template-renderer.js line 44
 */
export interface ForgeField {
  key: string;
  type: FieldType;
  label?: string;
  separator?: string;
  expression?: string;
  options?: string[];
}

/**
 * Color mapping configuration for a field.
 * Maps source field values to target field colors.
 * From template-renderer.js lines 504-523
 */
export interface ColorMapping {
  field: string;
  map?: Record<string, string>;
  default?: string;
  auto?: boolean;
}

/**
 * Aggregation configuration (structure inferred from project-format.js).
 * Placeholder for aggregation logic.
 */
export interface Aggregation {
  [key: string]: unknown;
}

/**
 * Card size dimensions.
 * From card-type-registry-core.js line 161 and template-renderer.js lines 778-779
 */
export interface CardSize {
  width: string;
  height: string;
}

/**
 * A card type schema defining the structure and rendering of cards.
 * From template-renderer.js line 43 and project-format.js lines 30-40
 */
export interface ForgeCardType {
  id: string;
  name: string;
  description?: string;
  fields: ForgeField[];
  frontTemplate: string;
  backTemplate?: string | null;
  css: string;
  cardSize: CardSize;
  colorMapping?: Record<string, ColorMapping> | null;
  aggregations?: Aggregation[] | null;
}

/**
 * A single row of card data.
 * From template-renderer.js line 45
 * Special columns: _type, _qty, _notes, _collections (from csv-parser.js line 42)
 */
export interface ForgeRow extends Record<string, unknown> {
  _type?: string;
  _qty?: number;
  _notes?: string;
  _collections?: string;
}

/**
 * An asset (image, font, etc.) stored as base64 data.
 * From template-renderer.js line 46
 */
export interface ForgeAsset {
  data: string;
  type: string;
}

/**
 * A font asset with optional family name.
 * From template-renderer.js line 665
 */
export interface ForgeFont extends ForgeAsset {
  family?: string;
}

/**
 * Template data passed to rendering functions.
 * From template-renderer.js line 42
 */
export type TemplateData = Record<string, unknown>;

/**
 * Dependencies for rendering operations.
 * From template-renderer.js lines 48-54
 */
export interface RenderDeps {
  globalVariables?: Record<string, string>;
  getAsset?: (name: string) => ForgeAsset | null;
  hashTagColor?: (value: string) => string;
}

/**
 * Options for rendering a full card.
 * From template-renderer.js line 670
 */
export interface RenderOptions {
  side?: 'front' | 'back';
  templateOverride?: string;
}

/**
 * Result of rendering a full card.
 * From template-renderer.js line 674
 */
export interface RenderResult {
  html: string;
  css: string;
  width: string;
  height: string;
  cardTypeId: string;
}

/**
 * Validation result with errors.
 * From global-variables.js lines 8-9 (pattern)
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Metadata for creating a new project.
 * Inferred from project-format.js lines 48-60
 */
export interface ProjectMeta {
  name: string;
  formatVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  defaultCardType?: string;
  cardSizePreset?: CardSize | null;
  settings?: Record<string, unknown>;
}

/**
 * A complete Forge project.
 * From template-renderer.js lines 659-666 and project-format.js lines 48-60
 */
export interface ForgeProject {
  name: string;
  formatVersion: number;
  cardTypes: ForgeCardType[];
  cardType?: ForgeCardType; // Legacy single card type
  defaultCardType?: string;
  data: ForgeRow[];
  globalVariables: Record<string, string>;
  assets: Record<string, ForgeAsset>;
  fonts: Record<string, ForgeFont>;
  createdAt?: string;
  updatedAt?: string;
  settings?: Record<string, unknown>;
  cardSizePreset?: CardSize | null;
}

/**
 * CSV parsing result.
 * From csv-parser.js lines 6-7
 */
export interface CsvParseResult {
  data: ForgeRow[];
  errors: string[];
}

/**
 * Icon queue item for async icon loading.
 * From icon-loader.js lines 21-25
 */
export interface IconQueueItem {
  url: string;
  key: string;
  resolve: (value: string) => void;
}
