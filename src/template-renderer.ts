/**
 * Mustache-like template renderer for card templates.
 *
 * Supported syntax:
 *   {{field}}                              — value substitution (HTML-escaped)
 *   {{{field}}}                            — raw value substitution (no escaping)
 *   {{#field}}...{{.}}...{{/field}}        — iterate over array (multi-select fields)
 *   {{#field}}...{{/field}}                — conditional block (truthy non-array fields)
 *   {{^field}}...{{/field}}                — inverted block (falsy/empty fields)
 *   {{#eq field "value"}}...{{/eq}}        — equality conditional block
 *   {{#neq field "value"}}...{{/neq}}      — not-equal conditional block
 *   {{#gt field value}}...{{/gt}}          — greater than
 *   {{#lt field value}}...{{/lt}}          — less than
 *   {{#gte field value}}...{{/gte}}        — greater than or equal
 *   {{#lte field value}}...{{/lte}}        — less than or equal
 *   {{#and field1 field2}}...{{/and}}      — both fields truthy
 *   {{#or field1 field2}}...{{/or}}        — either field truthy
 *   {{#not field}}...{{/not}}              — field is falsy
 *   {{upper field}}                        — UPPERCASE string helper
 *   {{lower field}}                        — lowercase string helper
 *   {{capitalize field}}                   — First Letter Capitalized
 *   {{truncate field N}}                   — truncate to N chars with "..."
 *   {{$varName}}                           — global variable substitution (HTML-escaped)
 *   {{{icon:field}}}                       — inline SVG icon from cached icon data
 *   {{{qr:field}}}                         — inline QR code SVG from field value
 *   {{{asset:filename}}}                   — data URI from asset library (P1-7)
 *
 * Performance: templates are compiled to segment-function arrays on first use
 * and cached by template string. Repeated renders of the same template
 * (e.g. 200 cards from one front.html) skip regex scanning entirely.
 */

import { resolveIconUrl, getCachedIcon } from "./icon-loader.js";
import { generateQrSvg } from "./qr-code.js";
import { injectVariables } from "./global-variables.js";
import { scopeCss } from "./card-type-registry-core.js";
import { hashTagColor } from "./color-utils.js";
import { getCardsByType } from "./project-query.js";

type TemplateData = Record<string, unknown>;

interface CardType {
  id: string;
  fields: CardField[];
  colorMapping?: Record<string, ColorMappingEntry> | null;
  frontTemplate?: string;
  backTemplate?: string | null;
  css?: string;
  cardSize?: { width: string; height: string };
}

interface CardField {
  key: string;
  type: string;
  label?: string;
  separator?: string;
  expression?: string;
}

type CardRow = Record<string, unknown>;

interface AssetEntry {
  data: string;
  type: string;
}

interface ColorMappingEntry {
  field: string;
  map?: Record<string, string>;
  default?: string;
  auto?: boolean;
}

interface RenderDeps {
  globalVariables?: Record<string, string>;
  getAsset?: (name: string) => AssetEntry | null;
  hashTagColor?: (value: string) => string;
}

interface Token {
  type: string;
  text?: string;
  field?: string;
  filename?: string;
  helper?: string;
  args?: string;
  tag?: string;
  name?: string;
  arg?: string;
}

type SegmentFn = (data: TemplateData, deps?: RenderDeps) => string;
type SegmentArray = SegmentFn[] & { _hasPlaceholder?: boolean };

const ESC_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) => ESC_MAP[c] || c);
}

function _missingAssetPlaceholder(filename: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#ccc"/><text x="100" y="90" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#666">Missing:</text><text x="100" y="115" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#666">${filename}</text></svg>`)}`;
}

/** @type {Map<string, SegmentFn>} — global cache, NOT per-project */
const templateCache = new Map<string, SegmentFn>();

const TOKEN_RE =
  /\{\{\{icon:(\w+)\}\}\}|\{\{\{qr:(\w+)\}\}\}|\{\{\{asset:([\w.\-]+)\}\}\}|\{\{\{([\w.@]+)\}\}\}|\{\{#(eq|neq|gt|lt|gte|lte|and|or|not)\s+([^}]+)\}\}|\{\{#(\w+)\}\}|\{\{\^(\w+)\}\}|\{\{\/([\w]+)\}\}|\{\{\$(\w+)\}\}|\{\{(upper|lower|capitalize|truncate)\s+(\w+)(?:\s+(\d+))?\}\}|\{\{([\w.@]+)\}\}/g;

const COMPARISON_HELPERS = new Set(["eq", "neq", "gt", "lt", "gte", "lte"]);
const BINARY_LOGIC_HELPERS = new Set(["and", "or"]);

export function compileTemplate(templateStr: string): SegmentFn {
  const cached = templateCache.get(templateStr);
  if (cached) return cached;
  const tokens = _tokenize(templateStr);
  const ctx = { pos: 0 };
  const segs = _parse(tokens, ctx, null);
  const fn: SegmentFn = (data, deps) => _exec(segs, data, deps);
  templateCache.set(templateStr, fn);
  return fn;
}

function _exec(segs: SegmentFn[], data: TemplateData, deps?: RenderDeps): string {
  let out = "";
  for (const s of segs) out += s(data, deps);
  return out;
}

function _tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  const re = new RegExp(TOKEN_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(template)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "literal", text: template.slice(last, m.index) });
    }

    if (m[1] !== undefined) {
      tokens.push({ type: "icon", field: m[1] });
    } else if (m[2] !== undefined) {
      tokens.push({ type: "qr", field: m[2] });
    } else if (m[3] !== undefined) {
      tokens.push({ type: "asset", filename: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ type: "raw", field: m[4] });
    } else if (m[5] !== undefined) {
      tokens.push({ type: "open", helper: m[5], args: m[6].trim(), tag: m[5] });
    } else if (m[7] !== undefined) {
      tokens.push({ type: "open", helper: "section", field: m[7], tag: m[7] });
    } else if (m[8] !== undefined) {
      tokens.push({ type: "open", helper: "inverted", field: m[8], tag: m[8] });
    } else if (m[9] !== undefined) {
      tokens.push({ type: "close", tag: m[9] });
    } else if (m[10] !== undefined) {
      tokens.push({ type: "variable", name: m[10] });
    } else if (m[11] !== undefined) {
      tokens.push({
        type: "string_helper",
        helper: m[11],
        field: m[12],
        arg: m[13],
      });
    } else if (m[14] !== undefined) {
      tokens.push({ type: "escaped", field: m[14] });
    }

    last = re.lastIndex;
  }

  if (last < template.length) {
    tokens.push({ type: "literal", text: template.slice(last) });
  }

  return tokens;
}

function _parse(tokens: Token[], ctx: { pos: number }, closeTag: string | null): SegmentArray {
  const segs: SegmentArray = [];
  let hasPlaceholder = false;

  while (ctx.pos < tokens.length) {
    const tok = tokens[ctx.pos];

    if (tok.type === "close") {
      if (tok.tag === closeTag) {
        ctx.pos++;
        break;
      }
      ctx.pos++;
      continue;
    }

    ctx.pos++;

    if (tok.type === "literal") {
      const text = tok.text || "";
      segs.push(() => text);
    } else if (tok.type === "icon") {
      const key = tok.field || "";
      segs.push((data) => {
        const val = data[key];
        if (!val) return "";
        const cached = getCachedIcon(String(val));
        if (cached) {
          return `<span class="icon-img" data-icon="${escapeHtml(String(val))}">${cached}</span>`;
        }
        const url = resolveIconUrl(String(val), "ffffff", "000000");
        if (url)
          return `<img src="${escapeHtml(url)}" class="icon-img" data-icon="${escapeHtml(String(val))}" alt="icon">`;
        return "";
      });
    } else if (tok.type === "qr") {
      const key = tok.field || "";
      segs.push((data) => {
        const val = data[key];
        if (!val) return "";
        return generateQrSvg(String(val));
      });
    } else if (tok.type === "asset") {
      const filename = tok.filename || "";
      segs.push((_data, deps) => {
        const ga = (deps && deps.getAsset) || (() => null);
        const asset =
          ga(filename) || (!filename.includes("/") && ga(`image/${filename}`));
        if (!asset) {
          console.warn(`[card-maker] Missing asset: ${filename}`);
          return _missingAssetPlaceholder(filename);
        }
        return asset.data;
      });
    } else if (tok.type === "raw") {
      const key = tok.field || "";
      if (key === "." || key === "@index") hasPlaceholder = true;
      segs.push((data) => {
        const val = data[key];
        if (val === undefined || val === null) return "";
        return String(val);
      });
    } else if (tok.type === "variable") {
      const key = tok.name || "";
      segs.push((data) => {
        const val = data[`$${key}`];
        if (val === undefined || val === null) return "";
        return escapeHtml(String(val));
      });
    } else if (tok.type === "string_helper") {
      segs.push(
        _makeStringHelperSeg(tok.helper || "", tok.field || "", tok.arg),
      );
    } else if (tok.type === "escaped") {
      const key = tok.field || "";
      if (key === "." || key === "@index") hasPlaceholder = true;
      segs.push((data) => {
        const val = data[key];
        if (val === undefined || val === null) return "";
        if (Array.isArray(val)) return escapeHtml(val.join(", "));
        return escapeHtml(String(val));
      });
    } else if (tok.type === "open") {
      _pushBlockSeg(segs, tok, tokens, ctx);
    }
  }

  segs._hasPlaceholder = hasPlaceholder;
  return segs;
}

function _makeStringHelperSeg(helper: string, field: string, arg: string | undefined): SegmentFn {
  return (data) => {
    const val = data[field];
    if (val === undefined || val === null) return "";
    const str = String(val);
    if (helper === "upper") return escapeHtml(str.toUpperCase());
    if (helper === "lower") return escapeHtml(str.toLowerCase());
    if (helper === "capitalize")
      return escapeHtml(str.replace(/\b\w/g, (c) => c.toUpperCase()));
    if (helper === "truncate") {
      const max = parseInt(arg || "20", 10) || 20;
      return escapeHtml(str.length <= max ? str : `${str.slice(0, max)}...`);
    }
    return escapeHtml(str);
  };
}

function _pushBlockSeg(
  segs: SegmentArray,
  tok: Token,
  tokens: Token[],
  ctx: { pos: number },
): void {
  const helper = tok.helper;

  if (helper === "section") {
    const key = tok.field || "";
    const innerSegs = _parse(tokens, ctx, tok.tag || null);
    const hasPh = !!innerSegs._hasPlaceholder;

    segs.push((data, deps) => {
      const val = data[key];
      if (Array.isArray(val)) {
        if (val.length === 0) return "";
        if (!hasPh) return _exec(innerSegs, data, deps);
        return val
          .map((item, i) =>
            _exec(
              innerSegs,
              { ...data, ".": String(item), "@index": String(i) },
              deps,
            ),
          )
          .join("");
      }
      if (val && val !== "") {
        return _exec(
          innerSegs,
          hasPh ? { ...data, ".": String(val) } : data,
          deps,
        );
      }
      return "";
    });
  } else if (helper === "inverted") {
    const key = tok.field || "";
    const innerSegs = _parse(tokens, ctx, tok.tag || null);
    segs.push((data, deps) => {
      const val = data[key];
      const empty =
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0);
      return empty ? _exec(innerSegs, data, deps) : "";
    });
  } else if (helper === "not") {
    const field = (tok.args || "").trim();
    const innerSegs = _parse(tokens, ctx, "not");
    segs.push((data, deps) => {
      const val = data[field];
      const empty =
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0);
      return empty ? _exec(innerSegs, data, deps) : "";
    });
  } else if (helper && COMPARISON_HELPERS.has(helper)) {
    const parsed = _parseComparisonArgs(tok.args || "");
    const innerSegs = _parse(tokens, ctx, helper);
    segs.push((data, deps) =>
      _evalComparison(helper, parsed.field, parsed.value, data)
        ? _exec(innerSegs, data, deps)
        : "",
    );
  } else if (helper && BINARY_LOGIC_HELPERS.has(helper)) {
    const parts = (tok.args || "").trim().split(/\s+/);
    const field1 = parts[0];
    const field2 = parts[1];
    const innerSegs = _parse(tokens, ctx, helper);
    segs.push((data, deps) => {
      const t1 = _isTruthy(data[field1]);
      const t2 = _isTruthy(data[field2]);
      return (helper === "and" ? t1 && t2 : t1 || t2)
        ? _exec(innerSegs, data, deps)
        : "";
    });
  }
}

function _isTruthy(val: unknown): boolean {
  if (val === undefined || val === null || val === "" || val === "0")
    return false;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

function _parseComparisonArgs(argsStr: string): { field: string; value: string } {
  const str = argsStr.trim();
  const quotedMatch = str.match(/^(\w+)\s+["']([^"']*)["']$/);
  if (quotedMatch) return { field: quotedMatch[1], value: quotedMatch[2] };
  const parts = str.split(/\s+/);
  return { field: parts[0], value: parts[1] || "" };
}

function _evalComparison(
  helper: string,
  field: string,
  expected: string,
  data: TemplateData,
): boolean {
  const val = data[field];
  const str = val === undefined || val === null ? "" : String(val);

  if (helper === "eq") return str === expected;
  if (helper === "neq") return str !== expected;

  const numVal = Number(str);
  const numExpected = Number(expected);
  if (isNaN(numVal) || isNaN(numExpected)) return false;

  if (helper === "gt") return numVal > numExpected;
  if (helper === "lt") return numVal < numExpected;
  if (helper === "gte") return numVal >= numExpected;
  if (helper === "lte") return numVal <= numExpected;
  return false;
}

export function preprocessRow(
  row: CardRow,
  fields: CardField[],
  cardType: CardType | null,
  deps: RenderDeps = {},
): TemplateData {
  const { hashTagColor: htc = () => "", getAsset: ga = () => null } = deps;
  const data: TemplateData = {};
  for (const field of fields) {
    if (field.type === "computed") continue;

    let val: unknown = row[field.key];
    if (val === undefined || val === null) val = "";
    if (typeof val === "string") val = val.trim();

    if (
      (field.type === "multi-select" || field.type === "tags") &&
      typeof val === "string" &&
      val.length > 0
    ) {
      const sep = field.separator || "|";
      data[field.key] = val
        .split(sep)
        .map((v) => v.trim())
        .filter(Boolean);
    } else {
      data[field.key] = val;
    }

    const fieldVal = data[field.key];
    if (typeof fieldVal === "string") {
      data[`${field.key}_lower`] = fieldVal.toLowerCase().replace(/\s+/g, "-");
    } else if (Array.isArray(fieldVal)) {
      data[`${field.key}_lower`] = fieldVal.map((v) =>
        String(v).toLowerCase().replace(/\s+/g, "-"),
      );
    }
  }

  for (const key of Object.keys(row)) {
    if (!(key in data)) {
      data[key] = row[key];
      if (typeof row[key] === "string") {
        data[`${key}_lower`] = (row[key] as string).toLowerCase().replace(/\s+/g, "-");
      }
    }
  }

  if (cardType && cardType.colorMapping) {
    for (const [targetField, mapping] of Object.entries(cardType.colorMapping)) {
      if (!data[targetField] || data[targetField] === "") {
        const sourceVal = data[mapping.field];
        const sourceStr = Array.isArray(sourceVal)
          ? String(sourceVal[0])
          : String(sourceVal || "");
        if (mapping.auto) {
          data[targetField] =
            (mapping.map && mapping.map[sourceStr]) ||
            (sourceStr ? htc(sourceStr) : mapping.default || "");
        } else {
          data[targetField] =
            (mapping.map && mapping.map[sourceStr]) || mapping.default || "";
        }
      }
    }
  }

  for (const field of fields) {
    if (field.type === "computed" && field.expression) {
      data[field.key] = evaluateExpression(field.expression, data);
      data[`${field.key}_lower`] = String(data[field.key]);
    }
  }

  for (const field of fields) {
    if (
      field.type === "image" ||
      field.type === "background" ||
      field.type === "pdf"
    ) {
      const val = data[field.key];
      if (typeof val === "string" && val) {
        data[field.key] = resolveAssetReference(val, ga);
      }
    }
  }

  return data;
}

export function renderTemplate(
  template: string,
  data: TemplateData,
  deps: RenderDeps = {},
): string {
  return compileTemplate(template)(data, deps);
}

export function renderCard(
  template: string,
  row: CardRow,
  fields: CardField[],
  cardType: CardType | null,
  deps: RenderDeps = {},
): string {
  const {
    globalVariables = {},
    getAsset: ga = () => null,
    hashTagColor: htc = () => "",
  } = deps;
  const data = preprocessRow(row, fields, cardType, {
    getAsset: ga,
    hashTagColor: htc,
  });
  const withVars = injectVariables(data, globalVariables) as TemplateData;
  return renderTemplate(template, withVars, deps);
}

export function getAutoColorVars(
  row: CardRow,
  cardType: CardType,
  hashTagColorFn: (v: string) => string = () => "",
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!cardType || !cardType.colorMapping) return vars;
  for (const [key, mapping] of Object.entries(cardType.colorMapping)) {
    const sourceVal = row[mapping.field];
    const sourceStr = Array.isArray(sourceVal)
      ? String(sourceVal[0])
      : String(sourceVal || "");
    const color =
      mapping.map && mapping.map[sourceStr]
        ? mapping.map[sourceStr]
        : mapping.auto && sourceStr
          ? hashTagColorFn(sourceStr)
          : mapping.default || "";
    if (color) {
      vars[`--cm-${key}`] = color;
    }
  }
  return vars;
}

export function resolveAssetReference(
  value: string,
  getAssetFn: (name: string) => AssetEntry | null = () => null,
): string {
  if (!value) return "";
  const str = value.trim();
  if (str.startsWith("http://") || str.startsWith("https://")) return str;
  const assetName = str.startsWith("asset:") ? str.slice(6) : str;
  if (!assetName) return "";
  const asset =
    getAssetFn(assetName) ||
    (!assetName.includes("/") && getAssetFn(`image/${assetName}`));
  if (asset) return asset.data;
  if (assetName.includes(".")) {
    console.warn(`[card-maker] Missing asset: ${assetName}`);
    return _missingAssetPlaceholder(assetName);
  }
  return str;
}

export function preprocessCssAssets(
  css: string,
  getAssetFn: (name: string) => AssetEntry | null = () => null,
): string {
  if (!css) return css;
  return css.replace(
    /\{\{\{asset:([\w.\-]+)\}\}\}/g,
    (_match: string, filename: string) => {
      const asset =
        getAssetFn(filename) ||
        (!filename.includes("/") && getAssetFn(`image/${filename}`));
      if (asset) return asset.data;
      console.warn(`[card-maker] Missing asset in CSS: ${filename}`);
      return _missingAssetPlaceholder(filename);
    },
  );
}

interface ForgeProject {
  name: string;
  cardTypes: CardType[];
  data: CardRow[];
  globalVariables: Record<string, string>;
  assets: Record<string, AssetEntry>;
  fonts: Record<string, AssetEntry & { family?: string }>;
}

interface RenderFullCardOptions {
  side?: 'front' | 'back';
}

interface RenderFullCardResult {
  html: string;
  css: string;
  width: string;
  height: string;
  cardTypeId: string;
}

export function detectFontFormat(filename: string): string {
  const ext = (filename || "").toLowerCase().split(".").pop();
  switch (ext) {
    case "otf":
      return "opentype";
    case "woff":
      return "woff";
    case "woff2":
      return "woff2";
    default:
      return "truetype";
  }
}

export function escapeCssFontName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildFontFaceCss(
  fonts: Record<string, AssetEntry & { family?: string }>,
): string {
  if (!fonts) return "";
  const entries = Object.entries(fonts);
  if (entries.length === 0) return "";
  return entries
    .filter(([, f]) => f.family && f.data)
    .map(
      ([filename, f]) =>
        `@font-face{font-family:"${escapeCssFontName(f.family!)}";src:url(${f.data}) format('${detectFontFormat(filename)}');font-display:swap}`,
    )
    .join("");
}

export function renderFullCard(
  project: ForgeProject,
  cardTypeId: string,
  row: CardRow,
  options: RenderFullCardOptions = {},
): RenderFullCardResult | null {
  const { side = "front" } = options;
  const cardType = (project.cardTypes || []).find((ct) => ct.id === cardTypeId);
  if (!cardType) return null;

  const template =
    side === "back" ? cardType.backTemplate : cardType.frontTemplate;
  if (!template) return null;

  let resolvedRow = row;
  if (side === "back" && Object.keys(row).length === 0) {
    const rows = getCardsByType(project as unknown as Record<string, unknown>, cardTypeId) as CardRow[];
    if (rows.length > 0) {
      resolvedRow = rows[0];
    }
  }

  const getAsset = (name: string): AssetEntry | null =>
    (project.assets && project.assets[name]) ||
    (project.fonts && project.fonts[name]) ||
    null;

  const html = renderCard(
    template,
    resolvedRow,
    cardType.fields || [],
    cardType,
    {
      globalVariables: project.globalVariables || {},
      getAsset,
      hashTagColor,
    },
  );

  let css = buildFontFaceCss(project.fonts);

  if (cardType.css) {
    css += scopeCss(preprocessCssAssets(cardType.css, getAsset), cardType.id);
  }

  const colorVars = getAutoColorVars(resolvedRow, cardType, hashTagColor);
  const colorEntries = Object.entries(colorVars);
  if (colorEntries.length > 0) {
    css += `[data-card-type="${cardType.id}"]{${colorEntries.map(([k, v]) => `${k}:${v}`).join(";")}}`;
  }

  return {
    html,
    css,
    width: cardType.cardSize ? cardType.cardSize.width : "63.5mm",
    height: cardType.cardSize ? cardType.cardSize.height : "88.9mm",
    cardTypeId: cardType.id,
  };
}

export function evaluateExpression(expression: string, data: TemplateData): number {
  const tokens = _tokenizeExpr(expression);
  const ctx = { pos: 0 };
  const result = _exprAddSub(tokens, ctx, data);
  return isNaN(result) ? 0 : result;
}

export function validateComputedFields(fields: CardField[]): string[] {
  const errors: string[] = [];
  const computedKeys = new Set(
    fields.filter((f) => f.type === "computed").map((f) => f.key),
  );

  for (const field of fields) {
    if (field.type !== "computed" || !field.expression) continue;
    const refs = field.expression.match(/[a-zA-Z_]\w*/g) || [];
    for (const ref of refs) {
      if (computedKeys.has(ref)) {
        errors.push(
          `Computed field "${field.key}" references another computed field "${ref}"`,
        );
      }
    }
  }
  return errors;
}

function _tokenizeExpr(expr: string): string[] {
  const tokens: string[] = [];
  const re = /\s*([+\-*/()]|\d+(?:\.\d+)?|[a-zA-Z_]\w*)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) tokens.push(m[1]);
  return tokens;
}

function _exprAddSub(tokens: string[], ctx: { pos: number }, data: TemplateData): number {
  let left = _exprMulDiv(tokens, ctx, data);
  while (
    ctx.pos < tokens.length &&
    (tokens[ctx.pos] === "+" || tokens[ctx.pos] === "-")
  ) {
    const op = tokens[ctx.pos++];
    const right = _exprMulDiv(tokens, ctx, data);
    left = op === "+" ? left + right : left - right;
  }
  return left;
}

function _exprMulDiv(tokens: string[], ctx: { pos: number }, data: TemplateData): number {
  let left = _exprAtom(tokens, ctx, data);
  while (
    ctx.pos < tokens.length &&
    (tokens[ctx.pos] === "*" || tokens[ctx.pos] === "/")
  ) {
    const op = tokens[ctx.pos++];
    const right = _exprAtom(tokens, ctx, data);
    left = op === "*" ? left * right : right !== 0 ? left / right : 0;
  }
  return left;
}

function _exprAtom(tokens: string[], ctx: { pos: number }, data: TemplateData): number {
  if (ctx.pos >= tokens.length) return 0;
  const tok = tokens[ctx.pos];
  if (tok === "(") {
    ctx.pos++;
    const val = _exprAddSub(tokens, ctx, data);
    if (ctx.pos < tokens.length && tokens[ctx.pos] === ")") ctx.pos++;
    return val;
  }
  if (tok === "-") {
    ctx.pos++;
    return -_exprAtom(tokens, ctx, data);
  }
  ctx.pos++;
  if (/^\d/.test(tok)) return parseFloat(tok);
  const fieldVal = Number(data[tok]);
  return isNaN(fieldVal) ? 0 : fieldVal;
}
