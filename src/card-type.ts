import type { Project } from './project.ts';
import type {
  ForgeCardType,
  ForgeField,
  ForgeRow,
  CardSize,
  ValidationResult,
} from './types.ts';

const VALID_FIELD_TYPES = [
  'text',
  'select',
  'multi-select',
  'tags',
  'url',
  'image',
  'number',
  'icon',
  'qr',
  'text-long',
  'richtext',
  'background',
  'pdf',
  'computed',
] as const;

const TYPE_ALIASES: Record<string, string> = { textarea: 'text-long' };

function sanitizeTemplate(html: string): string {
  let s = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<!-- script removed -->');
  s = s.replace(/<script\b[^>]*\/?>/gi, '<!-- script removed -->');
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(
    /(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    '$1="about:blank"',
  );
  s = s.replace(
    /(href|src|action)\s*=\s*(?:"vbscript:[^"]*"|'vbscript:[^']*')/gi,
    '$1="about:blank"',
  );
  return s;
}

function sanitizeCss(css: string): string {
  let s = css.replace(/@import\b[^;]+;/gi, '/* removed */');
  s = s.replace(/url\(\s*(['"]?)(https?:\/\/[^)'"]+)\1\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*"?\s*javascript:[^)"]*"?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*'?\s*javascript:[^)']*'?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*"?\s*vbscript:[^)"]*"?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*'?\s*vbscript:[^)']*'?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/expression\s*\([^)]*\)/gi, '/* expression removed */');
  s = s.replace(/behavior\s*:\s*url\([^)]*\)/gi, '/* behavior removed */');
  return s;
}

function scopeCss(css: string, cardTypeId: string): string {
  const scope = `[data-card-type="${cardTypeId}"]`;
  return css.replace(/([^{}@]+)\{/g, (match, selectorPart: string) => {
    const trimmed = selectorPart.trim();
    if (trimmed.startsWith('@') || trimmed === '') return match;
    const scoped = trimmed
      .split(',')
      .map((s) => {
        s = s.trim();
        if (!s) return s;
        if (s.includes('[data-card-type')) return s;
        if (s === 'body' || s === 'html') return scope;
        if (s.startsWith('body ')) return `${scope} ${s.slice(5)}`;
        if (s.startsWith('html ')) return `${scope} ${s.slice(5)}`;
        return `${scope} ${s}`;
      })
      .join(', ');
    return `${scoped} {`;
  });
}

function applyTypeAliases(fields: ForgeField[]): void {
  for (const f of fields) {
    if (f.type && TYPE_ALIASES[f.type]) {
      (f as unknown as Record<string, unknown>)['type'] = TYPE_ALIASES[f.type];
    }
  }
}

function validateFields(fields: ForgeField[]): void {
  for (const f of fields) {
    if (!f.key || typeof f.key !== 'string')
      throw new Error(`Field missing string "key": ${JSON.stringify(f)}`);
    if (!f.type || typeof f.type !== 'string')
      throw new Error(`Field "${f.key}" missing "type".`);
    if (!(VALID_FIELD_TYPES as readonly string[]).includes(f.type)) {
      throw new Error(
        `Field "${f.key}" has invalid type "${f.type}". Valid: ${VALID_FIELD_TYPES.join(', ')}`,
      );
    }
    if (f.options !== undefined && !Array.isArray(f.options)) {
      throw new Error(`Field "${f.key}" — "options" must be an array if provided.`);
    }
  }
}

function generateCsv(fields: ForgeField[], rows?: ForgeRow[]): string {
  const keys = fields.filter((f) => f.type !== 'computed').map((f) => f.key);

  if (rows && rows.length > 0) {
    const fieldKeySet = new Set(keys);
    for (const k of Object.keys(rows[0])) {
      if (
        !fieldKeySet.has(k) &&
        (k.toLowerCase() === '_qty' || k === '_type' || k === '_notes' || k === '_collections')
      ) {
        keys.push(k);
      }
    }
  }

  const lines = [keys.join(',')];
  if (rows) {
    for (const row of rows) {
      const vals = keys.map((k) => {
        const raw = row[k];
        let v = raw !== undefined && raw !== null ? String(raw) : '';
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
          v = `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      });
      lines.push(vals.join(','));
    }
  }
  return lines.join('\n');
}

export class Card {
  private _row: ForgeRow;
  private _cardType: CardType;

  constructor(row: ForgeRow, cardType: CardType) {
    this._row = row;
    this._cardType = cardType;
  }

  get row(): ForgeRow {
    return this._row;
  }

  get cardType(): CardType {
    return this._cardType;
  }

  getField(key: string): unknown {
    return this._row[key];
  }

  setField(key: string, value: unknown): void {
    this._row[key] = value;
  }
}

export class CardType {
  private _project: Project;
  private _data: ForgeCardType;
  private _cards: Card[] | null = null;

  constructor(project: Project, data: ForgeCardType) {
    this._project = project;
    this._data = data;
  }

  get project(): Project {
    return this._project;
  }

  get id(): string {
    return this._data.id;
  }

  get name(): string {
    return this._data.name;
  }

  get fields(): ForgeField[] {
    return this._data.fields;
  }

  get cardSize(): CardSize {
    return this._data.cardSize;
  }

  get frontTemplate(): string {
    return this._data.frontTemplate;
  }

  set frontTemplate(val: string) {
    this._data.frontTemplate = val;
  }

  get backTemplate(): string | null | undefined {
    return this._data.backTemplate;
  }

  set backTemplate(val: string | null | undefined) {
    this._data.backTemplate = val;
  }

  get css(): string {
    return this._data.css;
  }

  set css(val: string) {
    this._data.css = val;
  }

  validate(): ValidationResult {
    const errors: string[] = [];
    if (!this._data.id || typeof this._data.id !== 'string')
      errors.push('Missing or invalid "id"');
    if (!this._data.name || typeof this._data.name !== 'string')
      errors.push('Missing or invalid "name"');
    if (!this._data.fields || !Array.isArray(this._data.fields)) {
      errors.push('Missing or invalid "fields" array');
    } else {
      try {
        validateFields(this._data.fields);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  validateComputedFields(): string[] {
    const errors: string[] = [];
    const computedKeys = new Set(
      this._data.fields.filter((f) => f.type === 'computed').map((f) => f.key),
    );

    for (const field of this._data.fields) {
      if (field.type !== 'computed' || !field.expression) continue;
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

  private _getRows(): ForgeRow[] {
    const rows = this._project.data;
    if (rows.length === 0) return [];
    const hasTypeField = rows.some((r) => '_type' in r);
    if (!hasTypeField) return rows.slice();
    return rows.filter((r) => r._type === this._data.id);
  }

  private _invalidateCache(): void {
    this._cards = null;
  }

  getCards(): Card[] {
    if (this._cards !== null) return this._cards;
    const rows = this._getRows();
    this._cards = rows.map((row) => new Card(row, this));
    return this._cards;
  }

  getCard(index: number): Card | null {
    const cards = this.getCards();
    if (index < 0 || index >= cards.length) return null;
    return cards[index];
  }

  addCard(rowData: Partial<ForgeRow> = {}): Card {
    const newRow: ForgeRow = { ...rowData, _type: this._data.id };
    this._project.data.push(newRow);
    this._invalidateCache();
    const cards = this.getCards();
    return cards[cards.length - 1];
  }

  removeCard(card: Card): void {
    const idx = this._project.data.indexOf(card.row);
    if (idx !== -1) this._project.data.splice(idx, 1);
    this._invalidateCache();
  }

  exportCsv(): string {
    const rows = this._getRows();
    return generateCsv(this._data.fields, rows);
  }

  getScopedCss(): string {
    const shouldSanitize = (this._data as ForgeCardType & { _sanitizeCss?: boolean })._sanitizeCss ?? false;
    const processed = shouldSanitize ? sanitizeCss(this._data.css) : this._data.css;
    return scopeCss(processed, this._data.id);
  }

  static fromUpload(
    schema: {
      id: string;
      name: string;
      fields: ForgeField[];
      cardSize?: CardSize;
      description?: string;
      colorMapping?: unknown;
      aggregations?: unknown;
    },
    frontTemplate: string,
    backTemplate: string | null,
    css: string,
  ): ForgeCardType & { _sanitizeCss: boolean } {
    if (!schema.id || typeof schema.id !== 'string')
      throw new Error('Schema must have a string "id" field.');
    if (!schema.name || typeof schema.name !== 'string')
      throw new Error('Schema must have a string "name" field.');
    if (!schema.fields || !Array.isArray(schema.fields))
      throw new Error('Schema must have a "fields" array.');

    applyTypeAliases(schema.fields);
    validateFields(schema.fields);

    if (!frontTemplate.trim()) throw new Error('Front template cannot be empty.');

    return {
      id: schema.id,
      name: schema.name,
      description: schema.description || '',
      cardSize: schema.cardSize || { width: '63.5mm', height: '88.9mm' },
      fields: schema.fields,
      colorMapping: (schema.colorMapping as ForgeCardType['colorMapping']) || null,
      aggregations: (schema.aggregations as ForgeCardType['aggregations']) || null,
      frontTemplate: sanitizeTemplate(frontTemplate),
      backTemplate: backTemplate ? sanitizeTemplate(backTemplate) : null,
      css: css || '',
      _sanitizeCss: true,
    } as ForgeCardType & { _sanitizeCss: boolean };
  }

  static fromBundle(
    bundle: Record<string, unknown>,
  ): ForgeCardType & { _builtIn?: boolean; _sanitizeCss: boolean } {
    if (!bundle || typeof bundle !== 'object')
      throw new Error('Invalid bundle: expected a JSON object.');
    if (!bundle['id'] || typeof bundle['id'] !== 'string')
      throw new Error('Bundle must have a string "id" field.');
    if (!bundle['name'] || typeof bundle['name'] !== 'string')
      throw new Error('Bundle must have a string "name" field.');
    if (!bundle['fields'] || !Array.isArray(bundle['fields']))
      throw new Error('Bundle must have a "fields" array.');
    if (!bundle['frontTemplate'] || typeof bundle['frontTemplate'] !== 'string')
      throw new Error('Bundle must have a "frontTemplate" string.');

    const fields = bundle['fields'] as ForgeField[];
    applyTypeAliases(fields);
    validateFields(fields);

    const isBuiltIn = !!bundle['_builtIn'];
    const frontTemplate = bundle['frontTemplate'] as string;
    const backTemplate = bundle['backTemplate'] as string | null | undefined;

    return {
      id: bundle['id'] as string,
      name: bundle['name'] as string,
      description: (bundle['description'] as string) || '',
      cardSize: (bundle['cardSize'] as CardSize) || { width: '63.5mm', height: '88.9mm' },
      fields,
      colorMapping: (bundle['colorMapping'] as ForgeCardType['colorMapping']) || null,
      aggregations: (bundle['aggregations'] as ForgeCardType['aggregations']) || null,
      frontTemplate: isBuiltIn ? frontTemplate : sanitizeTemplate(frontTemplate),
      backTemplate: backTemplate
        ? isBuiltIn
          ? backTemplate
          : sanitizeTemplate(backTemplate)
        : null,
      css: (bundle['styles'] as string) || (bundle['css'] as string) || '',
      _builtIn: isBuiltIn,
      _sanitizeCss: !isBuiltIn,
    } as ForgeCardType & { _builtIn?: boolean; _sanitizeCss: boolean };
  }
}
