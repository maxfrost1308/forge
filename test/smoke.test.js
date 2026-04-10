import { describe, it, expect } from "vitest";

describe("forge-renderer", () => {
  it("module exports are defined", async () => {
    // Smoke test — verify the package structure resolves
    // Each export throws "Not implemented" but the import itself must succeed
    const mod = await import("../src/index.js");
    expect(mod.renderCard).toBeTypeOf("function");
    expect(mod.renderTemplate).toBeTypeOf("function");
    expect(mod.compileTemplate).toBeTypeOf("function");
    expect(mod.preprocessRow).toBeTypeOf("function");
    expect(mod.generateQrSvg).toBeTypeOf("function");
    expect(mod.validateVariableName).toBeTypeOf("function");
    expect(mod.injectVariables).toBeTypeOf("function");
    expect(mod.resolveIconUrl).toBeTypeOf("function");
    expect(mod.fetchIcon).toBeTypeOf("function");
    expect(mod.getCachedIcon).toBeTypeOf("function");
    expect(mod.parseCsv).toBeTypeOf("function");
    expect(mod.generateCsv).toBeTypeOf("function");
    expect(mod.validateCardType).toBeTypeOf("function");
    expect(mod.scopeCss).toBeTypeOf("function");
    expect(mod.sanitizeTemplate).toBeTypeOf("function");
    expect(mod.deserializeProject).toBeTypeOf("function");
    expect(mod.serializeProject).toBeTypeOf("function");
    expect(mod.hashTagColor).toBeTypeOf("function");
  });
});
