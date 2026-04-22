import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  generateQrSvg,
  hashTagColor,
  parseCsv,
  generateCsv,
  remapHeaders,
} from "../src/utils/index";
import type { ForgeField, ForgeRow, CsvParseResult } from "../src/types";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("A < B")).toBe("A &lt; B");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("A > B")).toBe("A &gt; B");
  });

  it("escapes double quote", () => {
    expect(escapeHtml('A "B" C')).toBe('A &quot;B&quot; C');
  });

  it("escapes single quote", () => {
    expect(escapeHtml("A 'B' C")).toBe("A &#39;B&#39; C");
  });

  it("escapes multiple special characters", () => {
    expect(escapeHtml('<div class="test">A & B</div>')).toBe(
      '&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;'
    );
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("converts non-string input to string", () => {
    expect(escapeHtml(123 as any)).toBe("123");
  });
});

describe("generateQrSvg", () => {
  it("returns a string", () => {
    expect(typeof generateQrSvg("hello")).toBe("string");
  });

  it("produces valid SVG markup", () => {
    const result = generateQrSvg("https://example.com");
    expect(result).toMatch(/^<svg /);
    expect(result).toMatch(/<\/svg>$/);
  });

  it("includes xmlns attribute", () => {
    expect(generateQrSvg("test")).toContain(
      'xmlns="http://www.w3.org/2000/svg"'
    );
  });

  it("includes a viewBox attribute", () => {
    expect(generateQrSvg("test")).toContain("viewBox=");
  });

  it("includes path data", () => {
    expect(generateQrSvg("test")).toContain('<path d="');
  });

  it("is deterministic", () => {
    const input = "https://example.com/card-maker";
    expect(generateQrSvg(input)).toBe(generateQrSvg(input));
  });

  it("produces different output for different inputs", () => {
    expect(generateQrSvg("hello")).not.toBe(generateQrSvg("world"));
  });

  it("returns empty string for empty input", () => {
    expect(generateQrSvg("")).toBe("");
  });

  it("returns empty string for non-string input", () => {
    expect(generateQrSvg(null as any)).toBe("");
  });
});

describe("hashTagColor", () => {
  it("returns a CSS hex color string", () => {
    expect(hashTagColor("fire")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("is deterministic for the same input", () => {
    expect(hashTagColor("dragon")).toBe(hashTagColor("dragon"));
  });

  it("returns different colors for different inputs", () => {
    const colors = new Set(
      ["fire", "water", "earth", "wind", "light", "dark"].map(hashTagColor)
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("handles empty string without throwing", () => {
    expect(() => hashTagColor("")).not.toThrow();
  });

  it("returns a color from the palette", () => {
    const color = hashTagColor("test");
    const palette = [
      "#6366f1",
      "#8b5cf6",
      "#ec4899",
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#14b8a6",
      "#06b6d4",
      "#3b82f6",
      "#a855f7",
      "#78716c",
    ];
    expect(palette).toContain(color);
  });
});

describe("parseCsv", () => {
  it("parses CSV string to data and errors", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const result = await parseCsv(csv);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ name: "Alice", age: "30" });
    expect(result.data[1]).toEqual({ name: "Bob", age: "25" });
  });

  it("returns empty data and error on invalid input", async () => {
    const result = await parseCsv("");
    expect(result.data).toEqual([]);
  });

  it("trims header whitespace", async () => {
    const csv = " name , age \nAlice,30";
    const result = await parseCsv(csv);
    expect(Object.keys(result.data[0])).toEqual(["name", "age"]);
  });

  it("skips empty lines", async () => {
    const csv = "name,age\nAlice,30\n\nBob,25";
    const result = await parseCsv(csv);
    expect(result.data).toHaveLength(2);
  });

  it("filters out FieldMismatch errors", async () => {
    const csv = "name,age\nAlice,30,extra";
    const result = await parseCsv(csv);
    // FieldMismatch errors should be filtered out
    const hasMismatchError = result.errors.some((e) =>
      e.includes("FieldMismatch")
    );
    expect(hasMismatchError).toBe(false);
  });
});

describe("generateCsv", () => {
  it("generates CSV header from fields", () => {
    const fields: ForgeField[] = [
      { key: "name", type: "text" },
      { key: "age", type: "number" },
    ];
    const csv = generateCsv(fields);
    expect(csv).toBe("name,age");
  });

  it("generates CSV with data rows", () => {
    const fields: ForgeField[] = [
      { key: "name", type: "text" },
      { key: "age", type: "number" },
    ];
    const rows: ForgeRow[] = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain("name,age");
    expect(csv).toContain("Alice,30");
    expect(csv).toContain("Bob,25");
  });

  it("excludes computed fields", () => {
    const fields: ForgeField[] = [
      { key: "name", type: "text" },
      { key: "computed_field", type: "computed" },
    ];
    const csv = generateCsv(fields);
    expect(csv).toBe("name");
  });

  it("quotes values with commas", () => {
    const fields: ForgeField[] = [{ key: "text", type: "text" }];
    const rows: ForgeRow[] = [{ text: "Hello, World" }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain('"Hello, World"');
  });

  it("quotes values with quotes", () => {
    const fields: ForgeField[] = [{ key: "text", type: "text" }];
    const rows: ForgeRow[] = [{ text: 'Say "Hi"' }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain('"Say ""Hi"""');
  });

  it("quotes values with newlines", () => {
    const fields: ForgeField[] = [{ key: "text", type: "text" }];
    const rows: ForgeRow[] = [{ text: "Line1\nLine2" }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("includes special columns from rows", () => {
    const fields: ForgeField[] = [{ key: "name", type: "text" }];
    const rows: ForgeRow[] = [{ name: "Alice", _qty: 5 }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain("_qty");
    expect(csv).toContain("5");
  });

  it("handles undefined and null values", () => {
    const fields: ForgeField[] = [{ key: "name", type: "text" }];
    const rows: ForgeRow[] = [{ name: undefined }, { name: null }];
    const csv = generateCsv(fields, rows);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("");
  });
});

describe("remapHeaders", () => {
  it("returns rows unchanged if no remap needed", () => {
    const fields: ForgeField[] = [
      { key: "name", type: "text" },
      { key: "age", type: "number" },
    ];
    const rows: ForgeRow[] = [{ name: "Alice", age: 30 }];
    const result = remapHeaders(rows, fields);
    expect(result).toEqual(rows);
  });

  it("remaps headers by label", () => {
    const fields: ForgeField[] = [
      { key: "name", type: "text", label: "Full Name" },
    ];
    const rows: ForgeRow[] = [{ "Full Name": "Alice" }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: "Alice" });
  });

  it("remaps headers case-insensitively", () => {
    const fields: ForgeField[] = [
      { key: "name", type: "text", label: "Full Name" },
    ];
    const rows: ForgeRow[] = [{ "full name": "Alice" }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: "Alice" });
  });

  it("returns empty array if no rows", () => {
    const fields: ForgeField[] = [{ key: "name", type: "text" }];
    const rows: ForgeRow[] = [];
    const result = remapHeaders(rows, fields);
    expect(result).toEqual([]);
  });

  it("returns empty array if no fields", () => {
    const rows: ForgeRow[] = [{ name: "Alice" }];
    const result = remapHeaders(rows, []);
    expect(result).toEqual(rows);
  });

  it("preserves unmapped columns", () => {
    const fields: ForgeField[] = [{ key: "name", type: "text" }];
    const rows: ForgeRow[] = [{ name: "Alice", extra: "value" }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: "Alice", extra: "value" });
  });
});
