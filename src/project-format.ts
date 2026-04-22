import type JSZip from "jszip";
import { generateCsv } from "./csv-parser.js";

function serializeCollections(collections: string[]): string {
  if (!collections || !Array.isArray(collections)) return "";
  return collections
    .map((s) => s.trim())
    .filter(Boolean)
    .join("|");
}

function parseCollections(str: string): string[] {
  if (!str || typeof str !== "string") return [];
  return str
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadJSZip() {
  const mod = await import("jszip");
  return mod.default || mod;
}

export const CURRENT_FORMAT_VERSION = 5;

function _buildSchema(ct: Record<string, unknown>): Record<string, unknown> {
  return {
    id: ct.id,
    name: ct.name,
    description: ct.description || "",
    cardSize: ct.cardSize,
    fields: ct.fields,
    colorMapping: ct.colorMapping || null,
    aggregations: ct.aggregations || null,
  };
}

export async function serializeProject(project: Record<string, unknown>): Promise<Blob> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const allTypes = (project.cardTypes as Record<string, unknown>[]) || [project.cardType];

  const meta = {
    formatVersion: 5,
    name: (project.name as string) || "Untitled Project",
    createdAt: (project.createdAt as string) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultCardType: project.defaultCardType || (allTypes[0] as Record<string, unknown>)?.id || null,
    globalVariables: project.globalVariables || {},
    settings: {
      defaultCardSize:
        project.cardSizePreset || (project.settings as Record<string, unknown>)?.defaultCardSize || null,
      ...(project.settings as Record<string, unknown>),
    },
  };

  zip.file("project.json", JSON.stringify(meta, null, 2));

  const dataByType = _splitDataByType(
    (project.data as Record<string, unknown>[]) || [],
    allTypes,
    (project.defaultCardType as string) || "",
  );

  for (const ct of allTypes) {
    const ctRec = ct as Record<string, unknown>;
    const dir = `card-types/${ctRec.id}/`;
    zip.file(`${dir}schema.json`, JSON.stringify(_buildSchema(ctRec), null, 2));
    zip.file(`${dir}front.html`, (ctRec.frontTemplate as string) || "");
    zip.file(`${dir}front.css`, (ctRec.css as string) || (ctRec.styles as string) || "");
    if (ctRec.backTemplate) {
      zip.file(`${dir}back.html`, ctRec.backTemplate as string);
    }
    const typeData = dataByType.get(ctRec.id as string) || [];
    if (typeData.length > 0) {
      const csv = generateCsv(ctRec.fields as Parameters<typeof generateCsv>[0], _stripTypeColumn(typeData));
      zip.file(`${dir}data.csv`, csv);
    }
  }

  if (project.assets && Object.keys(project.assets).length > 0) {
    for (const [filename, asset] of Object.entries(project.assets as Record<string, { data: string }>)) {
      const dataUri = asset.data;
      const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        const path = _assetPath(filename);
        zip.file(`assets/${path}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.fonts && Object.keys(project.fonts).length > 0) {
    for (const [filename, font] of Object.entries(project.fonts as Record<string, { data: string }>)) {
      const dataUri = font.data;
      const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        zip.file(`assets/fonts/${filename}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.pdfs && Object.keys(project.pdfs as object).length > 0) {
    for (const [filename, pdf] of Object.entries(project.pdfs as Record<string, { data: string }>)) {
      const dataUri = pdf.data;
      const base64Match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        zip.file(`assets/pdf/${filename}`, base64Match[1], { base64: true });
      }
    }
  }

  if (project.exportPresets && (project.exportPresets as unknown[]).length > 0) {
    for (const preset of project.exportPresets as Array<{ id: string }>) {
      zip.file(
        `export-presets/${preset.id}.json`,
        JSON.stringify(preset, null, 2),
      );
    }
  }

  return zip.generateAsync({ type: "blob" });
}

export async function serializeTemplateOnly(
  cardTypes: Record<string, unknown>[],
  options: {
    name?: string;
    globalVariables?: Record<string, string>;
    sampleRows?: number;
  } = {},
): Promise<Blob> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const name = options.name || "Template Export";
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

  zip.file("project.json", JSON.stringify(meta, null, 2));

  for (const ct of cardTypes) {
    const dir = `card-types/${ct.id}/`;
    zip.file(`${dir}schema.json`, JSON.stringify(_buildSchema(ct), null, 2));
    zip.file(`${dir}front.html`, (ct.frontTemplate as string) || "");
    zip.file(`${dir}front.css`, (ct.css as string) || (ct.styles as string) || "");
    if (ct.backTemplate) {
      zip.file(`${dir}back.html`, ct.backTemplate as string);
    }
    if (
      ct.sampleData &&
      Array.isArray(ct.sampleData) &&
      ct.sampleData.length > 0
    ) {
      const sampleToInclude = (ct.sampleData as unknown[]).slice(0, sampleRows);
      const csv = generateCsv(ct.fields as Parameters<typeof generateCsv>[0], sampleToInclude as Parameters<typeof generateCsv>[1]);
      zip.file(`${dir}sample.csv`, csv);
    }
  }

  return zip.generateAsync({ type: "blob" });
}

function _splitDataByType(
  data: Record<string, unknown>[],
  cardTypes: Record<string, unknown>[],
  defaultTypeId: string,
): Map<string, Record<string, unknown>[]> {
  const typeIds = new Set(cardTypes.map((ct) => ct.id as string));
  const result = new Map<string, Record<string, unknown>[]>();
  for (const ct of cardTypes) result.set(ct.id as string, []);

  const fallbackId = defaultTypeId || (cardTypes[0]?.id as string);

  for (const row of data) {
    const typeId =
      row._type && typeIds.has(String(row._type))
        ? String(row._type)
        : fallbackId;
    if (typeId && result.has(typeId)) {
      result.get(typeId)!.push(row);
    }
  }

  return result;
}

function _stripTypeColumn(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const copy = { ...row };
    delete copy._type;
    if (Array.isArray(copy._collections)) {
      copy._collections = serializeCollections(copy._collections as string[]);
    }
    return copy;
  });
}

function _assetPath(filename: string): string {
  if (
    filename.startsWith("image/") ||
    filename.startsWith("front/") ||
    filename.startsWith("back/") ||
    filename.startsWith("fonts/")
  ) {
    return filename;
  }
  return `image/${filename}`;
}

export async function deserializeProject(input: Blob | ArrayBuffer | string): Promise<Record<string, unknown>> {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(input);

  const projectFile = zip.file("project.json");
  if (!projectFile) {
    throw new Error("Invalid .forge file: missing project.json");
  }

  const metaText = await projectFile.async("string");
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(metaText);
  } catch {
    throw new Error("Invalid .forge file: corrupt project.json");
  }

  const fileVersion = (meta.formatVersion as number) || 1;
  if (fileVersion > CURRENT_FORMAT_VERSION) {
    throw new Error(
      "This project was created with a newer version of Card Maker",
    );
  }

  if (fileVersion >= 5) {
    return _deserializeV5(zip, meta);
  }

  return _migrateFromLegacy(zip, meta, fileVersion);
}

async function _deserializeV5(zip: JSZip, meta: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cardTypes: Record<string, unknown>[] = [];
  const allData: Record<string, unknown>[] = [];

  const cardTypeDirs = new Set<string>();
  zip.forEach((path: string) => {
    const match = path.match(/^card-types\/([^/]+)\//);
    if (match) cardTypeDirs.add(match[1]);
  });

  for (const typeId of cardTypeDirs) {
    const dir = `card-types/${typeId}/`;

    const schemaFile = zip.file(`${dir}schema.json`);
    if (!schemaFile) continue;
    const schema = JSON.parse(await schemaFile.async("string"));

    const frontHtmlFile = zip.file(`${dir}front.html`);
    const frontCssFile = zip.file(`${dir}front.css`);
    const backHtmlFile = zip.file(`${dir}back.html`);

    const frontTemplate = frontHtmlFile
      ? await frontHtmlFile.async("string")
      : "";
    const css = frontCssFile ? await frontCssFile.async("string") : "";
    const backTemplate = backHtmlFile
      ? await backHtmlFile.async("string")
      : null;

    cardTypes.push({ ...schema, frontTemplate, css, backTemplate });

    const dataFile = zip.file(`${dir}data.csv`);
    if (dataFile) {
      const csvText = await dataFile.async("string");
      if (csvText.trim()) {
        const { parseCsv } = await import("./csv-parser.js");
        const result = await parseCsv(csvText);
        for (const row of result.data) {
          (row as Record<string, unknown>)._type = typeId;
          if (typeof (row as Record<string, unknown>)._collections === "string" && (row as Record<string, unknown>)._collections) {
            (row as Record<string, unknown>)._collections = parseCollections((row as Record<string, string>)._collections);
          }
          allData.push(row as Record<string, unknown>);
        }
      }
    }
  }

  if (cardTypes.length === 0) {
    throw new Error("Invalid .forge file: no card types found");
  }

  const assets = await _deserializeAssets(zip);
  const fonts = await _deserializeFonts(zip);
  const pdfs = await _deserializePdfs(zip);
  const exportPresets = await _deserializeExportPresets(zip);

  const defaultCardType = (meta.defaultCardType as string) || cardTypes[0].id as string;
  const primaryType =
    cardTypes.find((ct) => ct.id === defaultCardType) || cardTypes[0];

  const settings = (meta.settings as Record<string, unknown>) || {};
  return {
    name: (meta.name as string) || "Untitled Project",
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
    pdfs,
    exportPresets,
    data: allData,
    _migrated: false,
  };
}

async function _migrateFromLegacy(zip: JSZip, meta: Record<string, unknown>, fileVersion: number): Promise<Record<string, unknown>> {
  let cardTypes: Record<string, unknown>[];
  if (
    meta.cardTypes &&
    Array.isArray(meta.cardTypes) &&
    meta.cardTypes.length > 0
  ) {
    cardTypes = meta.cardTypes as Record<string, unknown>[];
    if (!meta.cardType) meta.cardType = meta.cardTypes[0];
  } else if (meta.cardType && (meta.cardType as Record<string, unknown>).id && (meta.cardType as Record<string, unknown>).fields) {
    cardTypes = [meta.cardType as Record<string, unknown>];
    meta.defaultCardType = (meta.cardType as Record<string, unknown>).id;
  } else {
    throw new Error("Invalid .forge file: missing card type definition");
  }

  const primaryCt = meta.cardType as Record<string, unknown>;
  if (!primaryCt || !primaryCt.id || !primaryCt.fields) {
    throw new Error("Invalid .forge file: missing card type definition");
  }

  let data: Record<string, unknown>[] = [];
  const dataFile = zip.file("data/data.csv");
  if (dataFile) {
    const csvText = await dataFile.async("string");
    if (csvText.trim()) {
      const { parseCsv } = await import("./csv-parser.js");
      const result = await parseCsv(csvText);
      data = result.data as Record<string, unknown>[];
      for (const row of data) {
        if (typeof row._collections === "string" && row._collections) {
          row._collections = parseCollections(row._collections as string);
        }
      }
    }
  }

  const assets: Record<string, unknown> = {};
  const assetManifest = (meta.assetManifest as Record<string, { type?: string; size?: number }>) || {};
  for (const [filename, info] of Object.entries(assetManifest)) {
    const assetFile = zip.file(`assets/${filename}`);
    if (assetFile) {
      const base64 = await assetFile.async("base64");
      const mimeType = info.type || "image/png";
      const newKey = filename.includes("/") ? filename : `image/${filename}`;
      assets[newKey] = {
        data: `data:${mimeType};base64,${base64}`,
        type: mimeType,
        size: info.size || 0,
      };
    }
  }

  const fonts: Record<string, unknown> = {};
  const fontManifest = (meta.fontManifest as Record<string, { type?: string; size?: number; family?: string }>) || {};
  for (const [filename, info] of Object.entries(fontManifest)) {
    const fontFile = zip.file(`assets/fonts/${filename}`);
    if (fontFile) {
      const base64 = await fontFile.async("base64");
      const mimeType = info.type || "font/ttf";
      fonts[filename] = {
        data: `data:${mimeType};base64,${base64}`,
        type: mimeType,
        size: info.size || 0,
        family: info.family || filename.replace(/\.[^.]+$/, ""),
      };
    }
  }

  return {
    name: (meta.name as string) || "Untitled Project",
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

async function _deserializeAssets(zip: JSZip): Promise<Record<string, unknown>> {
  const assets: Record<string, unknown> = {};
  const assetFiles: string[] = [];

  zip.forEach((path: string, entry: { dir: boolean }) => {
    if (
      path.startsWith("assets/") &&
      !path.startsWith("assets/fonts/") &&
      !path.startsWith("assets/pdf/") &&
      !entry.dir
    ) {
      assetFiles.push(path);
    }
  });

  for (const path of assetFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async("base64");
    const rawKey = path.replace(/^assets\//, "");
    const key = rawKey.startsWith("front/")
      ? `image/${rawKey.slice(6)}`
      : rawKey;
    const ext = (key.split(".").pop() || "").toLowerCase();
    const mimeType = _mimeFromExt(ext);
    const assetObj = {
      data: `data:${mimeType};base64,${base64}`,
      type: mimeType,
      size: 0,
    };
    assets[key] = assetObj;
    const bareKey = key.replace(/^(image|back)\//, "");
    if (bareKey !== key) assets[bareKey] = assetObj;
  }

  return assets;
}

async function _deserializeFonts(zip: JSZip): Promise<Record<string, unknown>> {
  const fonts: Record<string, unknown> = {};
  const fontFiles: string[] = [];

  zip.forEach((path: string, entry: { dir: boolean }) => {
    if (path.startsWith("assets/fonts/") && !entry.dir) fontFiles.push(path);
  });

  for (const path of fontFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async("base64");
    const filename = path.replace("assets/fonts/", "");
    const ext = (filename.split(".").pop() || "").toLowerCase();
    const mimeType = _fontMimeFromExt(ext);
    fonts[filename] = {
      data: `data:${mimeType};base64,${base64}`,
      type: mimeType,
      size: 0,
      family: filename.replace(/\.[^.]+$/, ""),
    };
  }

  return fonts;
}

async function _deserializePdfs(zip: JSZip): Promise<Record<string, unknown>> {
  const pdfs: Record<string, unknown> = {};
  const pdfFiles: string[] = [];

  zip.forEach((path: string, entry: { dir: boolean }) => {
    if (path.startsWith("assets/pdf/") && !entry.dir) pdfFiles.push(path);
  });

  for (const path of pdfFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async("base64");
    const filename = path.replace("assets/pdf/", "");
    pdfs[filename] = {
      data: `data:application/pdf;base64,${base64}`,
      type: "application/pdf",
      size: 0,
      pageCount: 0,
    };
  }

  return pdfs;
}

async function _deserializeExportPresets(zip: JSZip): Promise<unknown[]> {
  const presets: unknown[] = [];
  const presetFiles: string[] = [];

  zip.forEach((path: string, entry: { dir: boolean }) => {
    if (
      path.startsWith("export-presets/") &&
      path.endsWith(".json") &&
      !entry.dir
    ) {
      presetFiles.push(path);
    }
  });

  for (const path of presetFiles) {
    const file = zip.file(path);
    if (!file) continue;
    try {
      const text = await file.async("string");
      presets.push(JSON.parse(text));
    } catch {
      // Skip malformed preset files
    }
  }

  return presets;
}

function _mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
  };
  return map[ext] || "application/octet-stream";
}

function _fontMimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  return map[ext] || "font/ttf";
}

export function validateProject(project: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!project)
    return { valid: false, errors: ["Project is null or undefined"] };

  const p = project as Record<string, unknown>;

  if (
    p.cardTypes &&
    Array.isArray(p.cardTypes) &&
    p.cardTypes.length > 0
  ) {
    for (let i = 0; i < p.cardTypes.length; i++) {
      const ct = p.cardTypes[i] as Record<string, unknown>;
      if (!ct.id) errors.push(`cardTypes[${i}]: missing id`);
      if (!ct.fields || !Array.isArray(ct.fields))
        errors.push(`cardTypes[${i}]: missing or invalid fields`);
      if (!ct.frontTemplate && !p.editorData)
        errors.push(`cardTypes[${i}]: missing frontTemplate`);
    }
  } else if (!p.cardType) {
    errors.push("Missing cardType");
  } else {
    const ct = p.cardType as Record<string, unknown>;
    if (!ct.id) errors.push("Missing cardType.id");
    if (!ct.fields || !Array.isArray(ct.fields)) {
      errors.push("Missing or invalid cardType.fields");
    }
    if (!ct.frontTemplate && !p.editorData) {
      errors.push("Missing cardType.frontTemplate");
    }
  }

  return { valid: errors.length === 0, errors };
}
