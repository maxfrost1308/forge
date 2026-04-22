import { describe, it, expect } from "vitest";
import { parseCsv, generateCsv, remapHeaders } from "../../src/csv-parser.js";

describe("parseCsv", () => {
  it("parses a basic CSV string with headers", async () => {
    const csv = "name,power\nSword,5\nAxe,8";
    const { data, errors } = await parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ name: "Sword", power: "5" });
    expect(data[1]).toMatchObject({ name: "Axe", power: "8" });
  });

  it("trims header whitespace", async () => {
    const csv = " name , value \nFern,42";
    const { data, errors } = await parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data[0]).toMatchObject({ name: "Fern", value: "42" });
  });

  it("skips empty lines", async () => {
    const csv = "name,val\nA,1\n\n\nB,2";
    const { data } = await parseCsv(csv);
    expect(data).toHaveLength(2);
  });

  it("returns empty data on empty CSV", async () => {
    const { data, errors } = await parseCsv("name,val");
    expect(data).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe("generateCsv", () => {
  it("generates header-only CSV when no sample rows provided", () => {
    const fields = [
      { key: "name", type: "text" },
      { key: "power", type: "number" },
    ];
    const result = generateCsv(fields, undefined);
    expect(result).toBe("name,power");
  });

  it("generates CSV with data rows", () => {
    const fields = [
      { key: "name", type: "text" },
      { key: "power", type: "number" },
    ];
    const rows = [{ name: "Sword", power: 5 }];
    const result = generateCsv(fields, rows);
    expect(result).toBe("name,power\nSword,5");
  });

  it("excludes computed fields from output", () => {
    const fields = [
      { key: "name", type: "text" },
      { key: "computed_val", type: "computed" },
    ];
    const result = generateCsv(fields, []);
    expect(result).toBe("name");
    expect(result).not.toContain("computed_val");
  });

  it("quotes values containing commas", () => {
    const fields = [{ key: "desc", type: "text" }];
    const rows = [{ desc: "hello, world" }];
    const result = generateCsv(fields, rows);
    expect(result).toContain('"hello, world"');
  });

  it("quotes values containing double quotes (escapes them)", () => {
    const fields = [{ key: "desc", type: "text" }];
    const rows = [{ desc: 'say "hi"' }];
    const result = generateCsv(fields, rows);
    expect(result).toContain('"say ""hi"""');
  });

  it("quotes values containing newlines", () => {
    const fields = [{ key: "desc", type: "text" }];
    const rows = [{ desc: "line1\nline2" }];
    const result = generateCsv(fields, rows);
    expect(result).toContain('"line1\nline2"');
  });

  it("adds _type column from sample rows if present", () => {
    const fields = [{ key: "name", type: "text" }];
    const rows = [{ name: "Card", _type: "hero" }];
    const result = generateCsv(fields, rows);
    expect(result).toContain("_type");
    expect(result).toContain("hero");
  });

  it("adds _qty column from sample rows if present", () => {
    const fields = [{ key: "name", type: "text" }];
    const rows = [{ name: "Card", _qty: "3" }];
    const result = generateCsv(fields, rows);
    expect(result).toContain("_qty");
  });

  it("adds _notes column from sample rows if present", () => {
    const fields = [{ key: "name", type: "text" }];
    const rows = [{ name: "Card", _notes: "some note" }];
    const result = generateCsv(fields, rows);
    expect(result).toContain("_notes");
  });

  it("adds _collections column from sample rows if present", () => {
    const fields = [{ key: "name", type: "text" }];
    const rows = [{ name: "Card", _collections: "set1" }];
    const result = generateCsv(fields, rows);
    expect(result).toContain("_collections");
  });

  it("handles undefined/null field values as empty string", () => {
    const fields = [{ key: "name", type: "text" }, { key: "desc", type: "text" }];
    const rows = [{ name: "Sword" }];
    const result = generateCsv(fields, rows);
    expect(result).toBe("name,desc\nSword,");
  });
});

describe("remapHeaders", () => {
  it("returns original rows unchanged when no remapping needed", () => {
    const fields = [{ key: "name", type: "text", label: "Name" }];
    const rows = [{ name: "Sword" }];
    const result = remapHeaders(rows, fields);
    expect(result).toBe(rows);
  });

  it("remaps label to key", () => {
    const fields = [{ key: "name", type: "text", label: "Card Name" }];
    const rows = [{ "Card Name": "Sword" }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toMatchObject({ name: "Sword" });
  });

  it("remaps lowercase label to key", () => {
    const fields = [{ key: "name", type: "text", label: "Card Name" }];
    const rows = [{ "card name": "Axe" }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toMatchObject({ name: "Axe" });
  });

  it("returns rows unchanged when empty rows array", () => {
    const fields = [{ key: "name", type: "text", label: "Name" }];
    const result = remapHeaders([], fields);
    expect(result).toEqual([]);
  });

  it("returns rows unchanged when empty fields array", () => {
    const rows = [{ name: "Sword" }];
    const result = remapHeaders(rows, []);
    expect(result).toEqual(rows);
  });

  it("keeps unknown headers as-is", () => {
    const fields = [{ key: "name", type: "text", label: "Name" }];
    const rows = [{ name: "Sword", extra: "bonus" }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toMatchObject({ extra: "bonus" });
  });
});
