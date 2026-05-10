import JSZip from 'jszip';
import Papa from 'papaparse';
import { ReadonlyProject } from './readonly-project';
import { buildFontFaceCss as _buildFontFaceCss, preprocessCssAssets as _preprocessCssAssets } from './template-renderer';
import type {
  ForgeProject,
  ForgeCardType,
  ForgeAsset,
  ForgeFont,
  ForgeRow,
  ProjectMeta,
  ValidationResult,
  CardSize,
} from './types.ts';

type ExtendedProject = ForgeProject & {
  pdfs?: Record<string, ForgeAsset & { pageCount?: number }>;
  exportPresets?: unknown[];
  editorData?: unknown;
};

function _validateVariableName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Variable name is required' };
  }
  if (!/^\w+$/.test(name)) {
    return { valid: false, error: 'Variable name must contain only letters, digits, and underscores' };
  }
  if (/^\d/.test(name)) {
    return { valid: false, error: 'Variable name must not start with a digit' };
  }
  return { valid: true };
}

function _serializeCollections(collections: string[]): string {
  if (!collections || !Array.isArray(collections)) return '';
  return collections.map((s) => s.trim()).filter(Boolean).join('|');
}

function _parseCollections(str: string): string[] {
  if (!str || typeof str !== 'string') return [];
  return str.split('|').map((s) => s.trim()).filter(Boolean);
}

async function _parseCsv(input: string): Promise<{ data: ForgeRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse<ForgeRow>(input, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string) => h.trim(),
      complete: (results) => {
        const errors = results.errors
          .filter((e) => e.type !== 'FieldMismatch')
          .map((e) => `Row ${e.row}: ${e.message}`);
        resolve({ data: results.data, errors });
      },
      error: (err: Error) => {
        resolve({ data: [], errors: [err.message] });
      },
    });
  });
}

function _generateCsv(fields: ForgeCardType['fields'], rows?: ForgeRow[]): string {
  const keys = fields.filter((f) => f.type !== 'computed').map((f) => f.key);

  if (rows && rows.length > 0) {
    const fieldKeySet = new Set(keys);
    for (const k of Object.keys(rows[0])) {
      if (!fieldKeySet.has(k) && (k.toLowerCase() === '_qty' || k === '_type' || k === '_notes' || k === '_collections')) {
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

function _buildSchema(ct: ForgeCardType): object {
  return {
    id: ct.id,
    name: ct.name,
    description: (ct as ForgeCardType & { description?: string }).description || '',
    cardSize: ct.cardSize,
    fields: ct.fields,
    colorMapping: ct.colorMapping || null,
    aggregations: ct.aggregations || null,
  };
}

function _splitDataByType(data: ForgeRow[], cardTypes: ForgeCardType[], defaultTypeId: string): Map<string, ForgeRow[]> {
  const typeIds = new Set(cardTypes.map((ct) => ct.id));
  const result = new Map<string, ForgeRow[]>();
  for (const ct of cardTypes) result.set(ct.id, []);
  const fallbackId = defaultTypeId || cardTypes[0]?.id;
  for (const row of data) {
    const typeId = row._type && typeIds.has(String(row._type)) ? String(row._type) : fallbackId;
    if (typeId && result.has(typeId)) {
      result.get(typeId)!.push(row);
    }
  }
  return result;
}

function _stripTypeColumn(rows: ForgeRow[]): ForgeRow[] {
  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    delete copy['_type'];
    if (Array.isArray(copy['_collections'])) {
      copy['_collections'] = _serializeCollections(copy['_collections'] as string[]);
    }
    return copy as ForgeRow;
  });
}

function _assetPath(filename: string): string {
  if (filename.startsWith('image/') || filename.startsWith('front/') || filename.startsWith('back/') || filename.startsWith('fonts/')) {
    return filename;
  }
  return `image/${filename}`;
}

function _mimeFromExt(ext: string): string {
  const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
  return map[ext] || 'application/octet-stream';
}

function _fontMimeFromExt(ext: string): string {
  const map: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
  return map[ext] || 'font/ttf';
}

async function _serializeProject(project: ExtendedProject): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const allTypes = project.cardTypes || (project.cardType ? [project.cardType] : []);

  const meta = {
    formatVersion: 5,
    name: project.name || 'Untitled Project',
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultCardType: project.defaultCardType || allTypes[0]?.id || null,
    globalVariables: project.globalVariables || {},
    settings: {
      defaultCardSize: project.cardSizePreset || (project.settings as Record<string, unknown>)?.['defaultCardSize'] || null,
      ...project.settings,
    },
  };

  zip.file('project.json', JSON.stringify(meta, null, 2));

  const dataByType = _splitDataByType(project.data || [], allTypes, project.defaultCardType || '');

  for (const ct of allTypes) {
    const dir = `card-types/${ct.id}/`;
    zip.file(`${dir}schema.json`, JSON.stringify(_buildSchema(ct), null, 2));
    zip.file(`${dir}front.html`, ct.frontTemplate || '');
    zip.file(`${dir}front.css`, ct.css || '');
    if (ct.backTemplate) {
      zip.file(`${dir}back.html`, ct.backTemplate);
    }
    const typeData = dataByType.get(ct.id) || [];
    if (typeData.length > 0) {
      const csv = _generateCsv(ct.fields, _stripTypeColumn(typeData));
      zip.file(`${dir}data.csv`, csv);
    }
  }

  if (project.assets && Object.keys(project.assets).length > 0) {
    for (const [filename, asset] of Object.entries(project.assets)) {
      const base64Match = asset.data.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        zip.file(`assets/${_assetPath(filename)}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.fonts && Object.keys(project.fonts).length > 0) {
    for (const [filename, font] of Object.entries(project.fonts)) {
      const base64Match = font.data.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        zip.file(`assets/fonts/${filename}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.pdfs && Object.keys(project.pdfs).length > 0) {
    for (const [filename, pdf] of Object.entries(project.pdfs)) {
      const base64Match = pdf.data.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        zip.file(`assets/pdf/${filename}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.exportPresets && project.exportPresets.length > 0) {
    for (const preset of project.exportPresets as Array<{ id: string }>) {
      zip.file(`export-presets/${preset.id}.json`, JSON.stringify(preset, null, 2));
    }
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function _serializeTemplateOnly(
  cardTypes: ForgeCardType[],
  options: { name?: string; globalVariables?: Record<string, string>; sampleRows?: number } = {},
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const sampleRowsCount = options.sampleRows ?? 3;

  const meta = {
    formatVersion: 5,
    name: options.name || 'Template Export',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultCardType: cardTypes[0]?.id || null,
    globalVariables: options.globalVariables || {},
    templateOnly: true,
    settings: {},
  };

  zip.file('project.json', JSON.stringify(meta, null, 2));

  for (const ct of cardTypes) {
    const dir = `card-types/${ct.id}/`;
    zip.file(`${dir}schema.json`, JSON.stringify(_buildSchema(ct), null, 2));
    zip.file(`${dir}front.html`, ct.frontTemplate || '');
    zip.file(`${dir}front.css`, ct.css || '');
    if (ct.backTemplate) {
      zip.file(`${dir}back.html`, ct.backTemplate);
    }
    const sampleData = (ct as ForgeCardType & { sampleData?: ForgeRow[] }).sampleData;
    if (sampleData && Array.isArray(sampleData) && sampleData.length > 0) {
      const csv = _generateCsv(ct.fields, sampleData.slice(0, sampleRowsCount));
      zip.file(`${dir}sample.csv`, csv);
    }
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function _deserializeAssets(zip: JSZip): Promise<Record<string, ForgeAsset>> {
  const assets: Record<string, ForgeAsset> = {};
  const assetFiles: string[] = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('assets/') && !path.startsWith('assets/fonts/') && !path.startsWith('assets/pdf/') && !entry.dir) {
      assetFiles.push(path);
    }
  });

  for (const path of assetFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async('base64');
    const rawKey = path.replace(/^assets\//, '');
    const key = rawKey.startsWith('front/') ? `image/${rawKey.slice(6)}` : rawKey;
    const ext = (key.split('.').pop() || '').toLowerCase();
    const mimeType = _mimeFromExt(ext);
    const assetObj: ForgeAsset = { data: `data:${mimeType};base64,${base64}`, type: mimeType };
    assets[key] = assetObj;
    const bareKey = key.replace(/^(image|back)\//, '');
    if (bareKey !== key) assets[bareKey] = assetObj;
  }

  return assets;
}

async function _deserializeFonts(zip: JSZip): Promise<Record<string, ForgeFont>> {
  const fonts: Record<string, ForgeFont> = {};
  const fontFiles: string[] = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('assets/fonts/') && !entry.dir) fontFiles.push(path);
  });

  for (const path of fontFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async('base64');
    const filename = path.replace('assets/fonts/', '');
    const ext = (filename.split('.').pop() || '').toLowerCase();
    fonts[filename] = {
      data: `data:${_fontMimeFromExt(ext)};base64,${base64}`,
      type: _fontMimeFromExt(ext),
      family: filename.replace(/\.[^.]+$/, ''),
    };
  }

  return fonts;
}

async function _deserializePdfs(zip: JSZip): Promise<Record<string, ForgeAsset & { pageCount: number }>> {
  const pdfs: Record<string, ForgeAsset & { pageCount: number }> = {};
  const pdfFiles: string[] = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('assets/pdf/') && !entry.dir) pdfFiles.push(path);
  });

  for (const path of pdfFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async('base64');
    const filename = path.replace('assets/pdf/', '');
    pdfs[filename] = { data: `data:application/pdf;base64,${base64}`, type: 'application/pdf', pageCount: 0 };
  }

  return pdfs;
}

async function _deserializeExportPresets(zip: JSZip): Promise<unknown[]> {
  const presets: unknown[] = [];
  const presetFiles: string[] = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('export-presets/') && path.endsWith('.json') && !entry.dir) {
      presetFiles.push(path);
    }
  });

  for (const path of presetFiles) {
    const file = zip.file(path);
    if (!file) continue;
    try {
      presets.push(JSON.parse(await file.async('string')));
    } catch {
    }
  }

  return presets;
}

async function _deserializeV5(zip: JSZip, meta: Record<string, unknown>): Promise<ExtendedProject> {
  const cardTypes: ForgeCardType[] = [];
  const allData: ForgeRow[] = [];

  const cardTypeDirs = new Set<string>();
  zip.forEach((path) => {
    const match = path.match(/^card-types\/([^/]+)\//);
    if (match) cardTypeDirs.add(match[1]);
  });

  for (const typeId of cardTypeDirs) {
    const dir = `card-types/${typeId}/`;
    const schemaFile = zip.file(`${dir}schema.json`);
    if (!schemaFile) continue;
    const schema = JSON.parse(await schemaFile.async('string')) as Partial<ForgeCardType>;

    const frontHtmlFile = zip.file(`${dir}front.html`);
    const frontCssFile = zip.file(`${dir}front.css`);
    const backHtmlFile = zip.file(`${dir}back.html`);

    const frontTemplate = frontHtmlFile ? await frontHtmlFile.async('string') : '';
    const css = frontCssFile ? await frontCssFile.async('string') : '';
    const backTemplate = backHtmlFile ? await backHtmlFile.async('string') : null;

    cardTypes.push({ ...schema, frontTemplate, css, backTemplate } as ForgeCardType);

    const dataFile = zip.file(`${dir}data.csv`);
    if (dataFile) {
      const csvText = await dataFile.async('string');
      if (csvText.trim()) {
        const result = await _parseCsv(csvText);
        for (const row of result.data) {
          row._type = typeId;
          if (typeof (row as Record<string, unknown>)['_collections'] === 'string' && row._collections) {
            (row as Record<string, unknown>)['_collections'] = _parseCollections(row._collections as string);
          }
          allData.push(row);
        }
      }
    }
  }

  if (cardTypes.length === 0) {
    throw new Error('Invalid .forge file: no card types found');
  }

  const assets = await _deserializeAssets(zip);
  const fonts = await _deserializeFonts(zip);
  const pdfs = await _deserializePdfs(zip);
  const exportPresets = await _deserializeExportPresets(zip);

  const settings = (meta['settings'] as Record<string, unknown>) || {};
  const defaultCardType = (meta['defaultCardType'] as string) || cardTypes[0].id;
  const primaryType = cardTypes.find((ct) => ct.id === defaultCardType) || cardTypes[0];

  return {
    name: (meta['name'] as string) || 'Untitled Project',
    formatVersion: 5,
    createdAt: meta['createdAt'] as string | undefined,
    updatedAt: meta['updatedAt'] as string | undefined,
    cardType: primaryType,
    cardTypes,
    defaultCardType,
    cardSizePreset: (settings['defaultCardSize'] as CardSize | null) ?? null,
    settings,
    globalVariables: (meta['globalVariables'] as Record<string, string>) || {},
    assets,
    fonts,
    data: allData,
    pdfs,
    exportPresets,
  };
}

async function _migrateFromLegacy(zip: JSZip, meta: Record<string, unknown>, fileVersion: number): Promise<ExtendedProject> {
  let cardTypes: ForgeCardType[];
  const metaCardTypes = meta['cardTypes'] as ForgeCardType[] | undefined;
  const metaCardType = meta['cardType'] as ForgeCardType | undefined;

  if (metaCardTypes && Array.isArray(metaCardTypes) && metaCardTypes.length > 0) {
    cardTypes = metaCardTypes;
    if (!metaCardType) meta['cardType'] = metaCardTypes[0];
  } else if (metaCardType && metaCardType.id && metaCardType.fields) {
    cardTypes = [metaCardType];
    meta['defaultCardType'] = metaCardType.id;
  } else {
    throw new Error('Invalid .forge file: missing card type definition');
  }

  const primaryCt = meta['cardType'] as ForgeCardType;
  if (!primaryCt || !primaryCt.id || !primaryCt.fields) {
    throw new Error('Invalid .forge file: missing card type definition');
  }

  let data: ForgeRow[] = [];
  const dataFile = zip.file('data/data.csv');
  if (dataFile) {
    const csvText = await dataFile.async('string');
    if (csvText.trim()) {
      const result = await _parseCsv(csvText);
      data = result.data;
      for (const row of data) {
        if (typeof (row as Record<string, unknown>)['_collections'] === 'string' && row._collections) {
          (row as Record<string, unknown>)['_collections'] = _parseCollections(row._collections as string);
        }
      }
    }
  }

  const assets: Record<string, ForgeAsset> = {};
  const assetManifest = (meta['assetManifest'] as Record<string, { type?: string; size?: number }>) || {};
  for (const [filename, info] of Object.entries(assetManifest)) {
    const assetFile = zip.file(`assets/${filename}`);
    if (assetFile) {
      const base64 = await assetFile.async('base64');
      const mimeType = info.type || 'image/png';
      const newKey = filename.includes('/') ? filename : `image/${filename}`;
      assets[newKey] = { data: `data:${mimeType};base64,${base64}`, type: mimeType };
    }
  }

  const fonts: Record<string, ForgeFont> = {};
  const fontManifest = (meta['fontManifest'] as Record<string, { type?: string; family?: string }>) || {};
  for (const [filename, info] of Object.entries(fontManifest)) {
    const fontFile = zip.file(`assets/fonts/${filename}`);
    if (fontFile) {
      const base64 = await fontFile.async('base64');
      const mimeType = info.type || 'font/ttf';
      fonts[filename] = {
        data: `data:${mimeType};base64,${base64}`,
        type: mimeType,
        family: info.family || filename.replace(/\.[^.]+$/, ''),
      };
    }
  }

  return {
    name: (meta['name'] as string) || 'Untitled Project',
    formatVersion: fileVersion,
    createdAt: meta['createdAt'] as string | undefined,
    updatedAt: meta['updatedAt'] as string | undefined,
    cardType: primaryCt,
    cardTypes,
    defaultCardType: (meta['defaultCardType'] as string) || primaryCt.id,
    cardSizePreset: (meta['cardSizePreset'] as CardSize | null) ?? null,
    settings: (meta['settings'] as Record<string, unknown>) || {},
    globalVariables: (meta['globalVariables'] as Record<string, string>) || {},
    assets,
    fonts,
    data,
    exportPresets: [],
  };
}

async function _loadZip(input: ArrayBuffer): Promise<ExtendedProject> {
  const zip = await JSZip.loadAsync(input);
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Invalid .forge file: missing project.json');
  }

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(await projectFile.async('string')) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid .forge file: corrupt project.json');
  }

  const fileVersion = (meta['formatVersion'] as number) || 1;
  if (fileVersion > 5) {
    throw new Error('This project was created with a newer version of Card Maker');
  }

  return fileVersion >= 5 ? _deserializeV5(zip, meta) : _migrateFromLegacy(zip, meta, fileVersion);
}

function _validateProject(project: ExtendedProject): ValidationResult {
  const errors: string[] = [];

  if (!project) return { valid: false, errors: ['Project is null or undefined'] };

  if (project.cardTypes && Array.isArray(project.cardTypes) && project.cardTypes.length > 0) {
    for (let i = 0; i < project.cardTypes.length; i++) {
      const ct = project.cardTypes[i];
      if (!ct.id) errors.push(`cardTypes[${i}]: missing id`);
      if (!ct.fields || !Array.isArray(ct.fields)) errors.push(`cardTypes[${i}]: missing or invalid fields`);
      if (!ct.frontTemplate && !project.editorData) errors.push(`cardTypes[${i}]: missing frontTemplate`);
    }
  } else if (!project.cardType) {
    errors.push('Missing cardType');
  } else {
    if (!project.cardType.id) errors.push('Missing cardType.id');
    if (!project.cardType.fields || !Array.isArray(project.cardType.fields)) errors.push('Missing or invalid cardType.fields');
    if (!project.cardType.frontTemplate && !project.editorData) errors.push('Missing cardType.frontTemplate');
  }

  return { valid: errors.length === 0, errors };
}

export class Project {
  static readonly FORMAT_VERSION = 5;
  private _state: ExtendedProject;

  private constructor(state: ExtendedProject) {
    this._state = state;
  }

  static async load(zipData: ArrayBuffer): Promise<Project> {
    return new Project(await _loadZip(zipData));
  }

  static fromScratch(meta: ProjectMeta): Project {
    return new Project({
      name: meta.name,
      formatVersion: 5,
      cardTypes: [],
      defaultCardType: meta.defaultCardType,
      data: [],
      globalVariables: {},
      assets: {},
      fonts: {},
      createdAt: meta.createdAt || new Date().toISOString(),
      updatedAt: meta.updatedAt || new Date().toISOString(),
      settings: meta.settings || {},
      cardSizePreset: meta.cardSizePreset || null,
    });
  }

  static from(stateData: ForgeProject): Project {
    return new Project(stateData as ExtendedProject);
  }

  async save(): Promise<ArrayBuffer> {
    return _serializeProject(this._state);
  }

  async saveTemplateOnly(options: { name?: string; globalVariables?: Record<string, string>; sampleRows?: number } = {}): Promise<ArrayBuffer> {
    return _serializeTemplateOnly(this._state.cardTypes, {
      name: options.name || this._state.name,
      globalVariables: options.globalVariables || this._state.globalVariables,
      sampleRows: options.sampleRows,
    });
  }

  validate(): ValidationResult {
    return _validateProject(this._state);
  }

  get name(): string {
    return this._state.name;
  }

  set name(value: string) {
    this._state.name = value;
  }

  get data(): ForgeRow[] {
    return this._state.data;
  }

  get cardTypes(): ForgeCardType[] {
    return this._state.cardTypes;
  }

  getCardType(id: string): ForgeCardType | null {
    return this._state.cardTypes.find((ct) => ct.id === id) ?? null;
  }

  addCardType(cardTypeData: ForgeCardType): ForgeCardType {
    this._state.cardTypes.push(cardTypeData);
    return cardTypeData;
  }

  removeCardType(id: string): void {
    const idx = this._state.cardTypes.findIndex((ct) => ct.id === id);
    if (idx !== -1) this._state.cardTypes.splice(idx, 1);
    for (let i = this._state.data.length - 1; i >= 0; i--) {
      if (this._state.data[i]._type === id) this._state.data.splice(i, 1);
    }
  }

  get globalVariables(): Record<string, string> {
    return this._state.globalVariables;
  }

  setVariable(name: string, value: string): void {
    const result = _validateVariableName(name);
    if (!result.valid) throw new Error(result.error);
    this._state.globalVariables[name] = value;
  }

  removeVariable(name: string): void {
    delete this._state.globalVariables[name];
  }

  get assets(): Record<string, ForgeAsset> {
    return this._state.assets;
  }

  addAsset(name: string, asset: ForgeAsset): void {
    this._state.assets[name] = asset;
  }

  getAsset(name: string): ForgeAsset | null {
    return this._state.assets[name] ?? null;
  }

  removeAsset(name: string): void {
    delete this._state.assets[name];
  }

  get fonts(): Record<string, ForgeFont> {
    return this._state.fonts;
  }

  addFont(name: string, font: ForgeFont): void {
    this._state.fonts[name] = font;
  }

  removeFont(name: string): void {
    delete this._state.fonts[name];
  }

  buildFontFaceCss(): string {
    return _buildFontFaceCss(this._state.fonts);
  }

  preprocessCssAssets(css: string): string {
    return _preprocessCssAssets(css, (name) => this._state.assets[name] ?? null);
  }

  readonly(): ReadonlyProject {
    return new ReadonlyProject(this);
  }

  async importCsv(csvText: string, cardTypeId?: string): Promise<void> {
    const result = await _parseCsv(csvText);
    const typeId = cardTypeId || this._state.defaultCardType || this._state.cardTypes[0]?.id;
    for (const row of result.data) {
      if (typeId) row._type = typeId;
      this._state.data.push(row);
    }
  }
}
