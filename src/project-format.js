// .forge ZIP format serialization/deserialization.
// Adapted from card-maker — no state.js imports, no DOM deps.

import { generateCsv } from './csv-parser.js';

// Inline from collections-state.js (2 pure functions, no state)
function serializeCollections(collections) {
  if (!collections || !Array.isArray(collections)) return '';
  return collections.map((s) => s.trim()).filter(Boolean).join('|');
}

function parseCollections(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split('|').map((s) => s.trim()).filter(Boolean);
}

async function loadJSZip() {
  const mod = await import('jszip');
  return mod.default || mod;
}

export const CURRENT_FORMAT_VERSION = 5;

function _buildSchema(ct) {
  return {
    id: ct.id,
    name: ct.name,
    description: ct.description || '',
    cardSize: ct.cardSize,
    fields: ct.fields,
    colorMapping: ct.colorMapping || null,
    aggregations: ct.aggregations || null,
  };
}

export async function serializeProject(project) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const allTypes = project.cardTypes || [project.cardType];

  const meta = {
    formatVersion: 5,
    name: project.name || 'Untitled Project',
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultCardType: project.defaultCardType || allTypes[0]?.id || null,
    globalVariables: project.globalVariables || {},
    settings: {
      defaultCardSize: project.cardSizePreset || project.settings?.defaultCardSize || null,
      ...project.settings,
    },
  };

  zip.file('project.json', JSON.stringify(meta, null, 2));

  const dataByType = _splitDataByType(project.data || [], allTypes, project.defaultCardType || '');

  for (const ct of allTypes) {
    const dir = `card-types/${ct.id}/`;
    zip.file(`${dir}schema.json`, JSON.stringify(_buildSchema(ct), null, 2));
    zip.file(`${dir}front.html`, ct.frontTemplate || '');
    zip.file(`${dir}front.css`, ct.css || ct.styles || '');
    if (ct.backTemplate) {
      zip.file(`${dir}back.html`, ct.backTemplate);
    }
    const typeData = dataByType.get(ct.id) || [];
    if (typeData.length > 0) {
      const csv = generateCsv(ct.fields, _stripTypeColumn(typeData));
      zip.file(`${dir}data.csv`, csv);
    }
  }

  if (project.assets && Object.keys(project.assets).length > 0) {
    for (const [filename, asset] of Object.entries(project.assets)) {
      const dataUri = asset.data;
      const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        const path = _assetPath(filename);
        zip.file(`assets/${path}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.fonts && Object.keys(project.fonts).length > 0) {
    for (const [filename, font] of Object.entries(project.fonts)) {
      const dataUri = font.data;
      const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        zip.file(`assets/fonts/${filename}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.exportPresets && project.exportPresets.length > 0) {
    for (const preset of project.exportPresets) {
      zip.file(`export-presets/${preset.id}.json`, JSON.stringify(preset, null, 2));
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function serializeTemplateOnly(cardTypes, options = {}) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const name = options.name || 'Template Export';
  const globalVariables = options.globalVariables || {};
  const sampleRows = options.sampleRows ?? 3;

  const meta = {
    formatVersion: 5,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultCardType: cardTypes[0]?.id || null,
    globalVariables,
    templateOnly: true,
    settings: {},
  };

  zip.file('project.json', JSON.stringify(meta, null, 2));

  for (const ct of cardTypes) {
    const dir = `card-types/${ct.id}/`;
    zip.file(`${dir}schema.json`, JSON.stringify(_buildSchema(ct), null, 2));
    zip.file(`${dir}front.html`, ct.frontTemplate || '');
    zip.file(`${dir}front.css`, ct.css || ct.styles || '');
    if (ct.backTemplate) {
      zip.file(`${dir}back.html`, ct.backTemplate);
    }
    if (ct.sampleData && Array.isArray(ct.sampleData) && ct.sampleData.length > 0) {
      const sampleToInclude = ct.sampleData.slice(0, sampleRows);
      const csv = generateCsv(ct.fields, sampleToInclude);
      zip.file(`${dir}sample.csv`, csv);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

function _splitDataByType(data, cardTypes, defaultTypeId) {
  const typeIds = new Set(cardTypes.map((ct) => ct.id));
  const result = new Map();
  for (const ct of cardTypes) result.set(ct.id, []);

  const fallbackId = defaultTypeId || cardTypes[0]?.id;

  for (const row of data) {
    const typeId = row._type && typeIds.has(String(row._type)) ? String(row._type) : fallbackId;
    if (typeId && result.has(typeId)) {
      result.get(typeId).push(row);
    }
  }

  return result;
}

function _stripTypeColumn(rows) {
  return rows.map((row) => {
    const copy = { ...row };
    delete copy._type;
    if (Array.isArray(copy._collections)) {
      copy._collections = serializeCollections(copy._collections);
    }
    return copy;
  });
}

function _assetPath(filename) {
  if (
    filename.startsWith('image/') ||
    filename.startsWith('front/') ||
    filename.startsWith('back/') ||
    filename.startsWith('fonts/')
  ) {
    return filename;
  }
  return `image/${filename}`;
}

export async function deserializeProject(input) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(input);

  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Invalid .forge file: missing project.json');
  }

  const metaText = await projectFile.async('string');
  let meta;
  try {
    meta = JSON.parse(metaText);
  } catch {
    throw new Error('Invalid .forge file: corrupt project.json');
  }

  const fileVersion = meta.formatVersion || 1;
  if (fileVersion > CURRENT_FORMAT_VERSION) {
    throw new Error('This project was created with a newer version of Card Maker');
  }

  if (fileVersion >= 5) {
    return _deserializeV5(zip, meta);
  }

  return _migrateFromLegacy(zip, meta, fileVersion);
}

async function _deserializeV5(zip, meta) {
  const cardTypes = [];
  const allData = [];

  const cardTypeDirs = new Set();
  zip.forEach((path) => {
    const match = path.match(/^card-types\/([^/]+)\//);
    if (match) cardTypeDirs.add(match[1]);
  });

  for (const typeId of cardTypeDirs) {
    const dir = `card-types/${typeId}/`;

    const schemaFile = zip.file(`${dir}schema.json`);
    if (!schemaFile) continue;
    const schema = JSON.parse(await schemaFile.async('string'));

    const frontHtmlFile = zip.file(`${dir}front.html`);
    const frontCssFile = zip.file(`${dir}front.css`);
    const backHtmlFile = zip.file(`${dir}back.html`);

    const frontTemplate = frontHtmlFile ? await frontHtmlFile.async('string') : '';
    const css = frontCssFile ? await frontCssFile.async('string') : '';
    const backTemplate = backHtmlFile ? await backHtmlFile.async('string') : null;

    cardTypes.push({ ...schema, frontTemplate, css, backTemplate });

    const dataFile = zip.file(`${dir}data.csv`);
    if (dataFile) {
      const csvText = await dataFile.async('string');
      if (csvText.trim()) {
        const { parseCsv } = await import('./csv-parser.js');
        const result = await parseCsv(csvText);
        for (const row of result.data) {
          row._type = typeId;
          if (typeof row._collections === 'string' && row._collections) {
            row._collections = parseCollections(row._collections);
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
  const exportPresets = await _deserializeExportPresets(zip);

  const defaultCardType = meta.defaultCardType || cardTypes[0].id;
  const primaryType = cardTypes.find((ct) => ct.id === defaultCardType) || cardTypes[0];

  const settings = meta.settings || {};
  return {
    name: meta.name || 'Untitled Project',
    formatVersion: 5,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    cardType: primaryType,
    cardTypes,
    defaultCardType,
    cardSizePreset: settings.defaultCardSize ?? null,
    settings,
    globalVariables: meta.globalVariables || {},
    editorData: meta.editorData || null,
    assets,
    fonts,
    exportPresets,
    data: allData,
    _migrated: false,
  };
}

async function _migrateFromLegacy(zip, meta, fileVersion) {
  let cardTypes;
  if (meta.cardTypes && Array.isArray(meta.cardTypes) && meta.cardTypes.length > 0) {
    cardTypes = meta.cardTypes;
    if (!meta.cardType) meta.cardType = meta.cardTypes[0];
  } else if (meta.cardType && meta.cardType.id && meta.cardType.fields) {
    cardTypes = [meta.cardType];
    meta.defaultCardType = meta.cardType.id;
  } else {
    throw new Error('Invalid .forge file: missing card type definition');
  }

  const primaryCt = meta.cardType;
  if (!primaryCt || !primaryCt.id || !primaryCt.fields) {
    throw new Error('Invalid .forge file: missing card type definition');
  }

  let data = [];
  const dataFile = zip.file('data/data.csv');
  if (dataFile) {
    const csvText = await dataFile.async('string');
    if (csvText.trim()) {
      const { parseCsv } = await import('./csv-parser.js');
      const result = await parseCsv(csvText);
      data = result.data;
      for (const row of data) {
        if (typeof row._collections === 'string' && row._collections) {
          row._collections = parseCollections(row._collections);
        }
      }
    }
  }

  const assets = {};
  const assetManifest = meta.assetManifest || {};
  for (const [filename, info] of Object.entries(assetManifest)) {
    const assetFile = zip.file(`assets/${filename}`);
    if (assetFile) {
      const base64 = await assetFile.async('base64');
      const mimeType = info.type || 'image/png';
      const newKey = filename.includes('/') ? filename : `image/${filename}`;
      assets[newKey] = { data: `data:${mimeType};base64,${base64}`, type: mimeType, size: info.size || 0 };
    }
  }

  const fonts = {};
  const fontManifest = meta.fontManifest || {};
  for (const [filename, info] of Object.entries(fontManifest)) {
    const fontFile = zip.file(`assets/fonts/${filename}`);
    if (fontFile) {
      const base64 = await fontFile.async('base64');
      const mimeType = info.type || 'font/ttf';
      fonts[filename] = {
        data: `data:${mimeType};base64,${base64}`,
        type: mimeType,
        size: info.size || 0,
        family: info.family || filename.replace(/\.[^.]+$/, ''),
      };
    }
  }

  return {
    name: meta.name || 'Untitled Project',
    formatVersion: fileVersion,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    cardType: primaryCt,
    cardTypes,
    defaultCardType: meta.defaultCardType || primaryCt.id,
    cardSizePreset: meta.cardSizePreset ?? null,
    settings: meta.settings || {},
    globalVariables: meta.globalVariables || {},
    editorData: meta.editorData || null,
    assets,
    fonts,
    exportPresets: [],
    data,
    _migrated: true,
    _migratedFrom: fileVersion,
  };
}

async function _deserializeAssets(zip) {
  const assets = {};
  const assetFiles = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('assets/') && !path.startsWith('assets/fonts/') && !entry.dir) {
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
    const assetObj = { data: `data:${mimeType};base64,${base64}`, type: mimeType, size: 0 };
    assets[key] = assetObj;
    const bareKey = key.replace(/^(image|back)\//, '');
    if (bareKey !== key) assets[bareKey] = assetObj;
  }

  return assets;
}

async function _deserializeFonts(zip) {
  const fonts = {};
  const fontFiles = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('assets/fonts/') && !entry.dir) fontFiles.push(path);
  });

  for (const path of fontFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async('base64');
    const filename = path.replace('assets/fonts/', '');
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const mimeType = _fontMimeFromExt(ext);
    fonts[filename] = {
      data: `data:${mimeType};base64,${base64}`,
      type: mimeType,
      size: 0,
      family: filename.replace(/\.[^.]+$/, ''),
    };
  }

  return fonts;
}

async function _deserializeExportPresets(zip) {
  const presets = [];
  const presetFiles = [];

  zip.forEach((path, entry) => {
    if (path.startsWith('export-presets/') && path.endsWith('.json') && !entry.dir) {
      presetFiles.push(path);
    }
  });

  for (const path of presetFiles) {
    const file = zip.file(path);
    if (!file) continue;
    try {
      const text = await file.async('string');
      presets.push(JSON.parse(text));
    } catch {
      // Skip malformed preset files
    }
  }

  return presets;
}

function _mimeFromExt(ext) {
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  };
  return map[ext] || 'application/octet-stream';
}

function _fontMimeFromExt(ext) {
  const map = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
  return map[ext] || 'font/ttf';
}

export function validateProject(project) {
  const errors = [];

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
    if (!project.cardType.fields || !Array.isArray(project.cardType.fields)) {
      errors.push('Missing or invalid cardType.fields');
    }
    if (!project.cardType.frontTemplate && !project.editorData) {
      errors.push('Missing cardType.frontTemplate');
    }
  }

  return { valid: errors.length === 0, errors };
}
