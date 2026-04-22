/**
 * CSV parsing and generation utilities.
 */

import type { ForgeField, ForgeRow, CsvParseResult } from "../types";

/**
 * Parse a CSV File object or string into an array of row objects.
 * @param input - File or string to parse
 * @returns Promise resolving to parsed data and errors
 */
export async function parseCsv(input: File | string): Promise<CsvParseResult> {
  return new Promise(async (resolve) => {
    // @ts-ignore - papaparse lacks type definitions
    const Papa = (await import("papaparse")).default;
    Papa.parse(input, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h: string) => h.trim(),
      complete: (results: any) => {
        const errors = results.errors
          .filter((e: any) => e.type !== "FieldMismatch")
          .map((e: any) => `Row ${e.row}: ${e.message}`);
        resolve({ data: results.data, errors });
      },
      error: (err: any) => {
        resolve({ data: [], errors: [err.message] });
      },
    });
  });
}

/**
 * Generate a CSV string from fields and optional sample rows.
 * @param fields - Array of field definitions
 * @param sampleRows - Optional array of data rows
 * @returns CSV string
 */
export function generateCsv(fields: ForgeField[], sampleRows?: ForgeRow[]): string {
  const keys = fields.filter((f) => f.type !== "computed").map((f) => f.key);

  if (sampleRows && sampleRows.length > 0) {
    const fieldKeySet = new Set(keys);
    for (const k of Object.keys(sampleRows[0])) {
      if (
        !fieldKeySet.has(k) &&
        (k.toLowerCase() === "_qty" || k === "_type" || k === "_notes" || k === "_collections")
      ) {
        keys.push(k);
      }
    }
  }

  const lines = [keys.join(",")];

  if (sampleRows) {
    for (const row of sampleRows) {
      const vals = keys.map((k) => {
        const raw = row[k];
        let v = raw !== undefined && raw !== null ? String(raw) : "";
        if (v.includes(",") || v.includes('"') || v.includes("\n")) {
          v = `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      });
      lines.push(vals.join(","));
    }
  }

  return lines.join("\n");
}

/**
 * Remap CSV row headers from labels to current field keys.
 * @param rows - Array of data rows
 * @param fields - Array of field definitions
 * @returns Remapped rows
 */
export function remapHeaders(rows: ForgeRow[], fields: ForgeField[]): ForgeRow[] {
  if (!rows.length || !fields.length) return rows;

  const headerToKey: Record<string, string> = {};
  for (const f of fields) {
    headerToKey[f.key] = f.key;
    if (f.label) {
      headerToKey[f.label] = f.key;
      headerToKey[f.label.toLowerCase()] = f.key;
    }
  }

  const sampleHeaders = Object.keys(rows[0]);
  const needsRemap = sampleHeaders.some((h) => !(h in headerToKey) || headerToKey[h] !== h);
  if (!needsRemap) return rows;

  return rows.map((row) => {
    const mapped: ForgeRow = {};
    for (const [header, value] of Object.entries(row)) {
      const key = headerToKey[header] || headerToKey[header.toLowerCase()] || header;
      mapped[key] = value;
    }
    return mapped;
  });
}
