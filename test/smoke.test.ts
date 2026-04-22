import { describe, it, expect } from "vitest";

describe("forge-renderer", () => {
  it("module exports are defined", async () => {
    const mod = await import("../src/index.ts");
    expect(mod.Project).toBeTypeOf("function");
    expect(mod.CardType).toBeTypeOf("function");
    expect(mod.Card).toBeTypeOf("function");
    expect(mod.ReadonlyProject).toBeTypeOf("function");
    expect(mod.IconCache).toBeTypeOf("function");
    expect(mod.escapeHtml).toBeTypeOf("function");
    expect(mod.generateQrSvg).toBeTypeOf("function");
    expect(mod.hashTagColor).toBeTypeOf("function");
    expect(mod.parseCsv).toBeTypeOf("function");
    expect(mod.generateCsv).toBeTypeOf("function");
    expect(mod.remapHeaders).toBeTypeOf("function");
  });
});
