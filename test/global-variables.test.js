import { describe, it, expect } from "vitest";
import { validateVariableName, injectVariables, findVariableReferences } from "../src/global-variables.js";

describe("validateVariableName", () => {
  it("accepts valid name", () => {
    expect(validateVariableName("gameName").valid).toBe(true);
  });

  it("rejects empty name", () => {
    expect(validateVariableName("").valid).toBe(false);
  });

  it("rejects name starting with digit", () => {
    expect(validateVariableName("1name").valid).toBe(false);
  });

  it("rejects name with special chars", () => {
    expect(validateVariableName("my-var").valid).toBe(false);
  });
});

describe("injectVariables", () => {
  it("injects variables with $ prefix", () => {
    const result = injectVariables({ name: "Fern" }, { gameName: "Dragon Wars" });
    expect(result.$gameName).toBe("Dragon Wars");
    expect(result.name).toBe("Fern");
  });

  it("returns data unchanged when no variables", () => {
    const data = { name: "Fern" };
    expect(injectVariables(data, {})).toBe(data);
  });
});

describe("findVariableReferences", () => {
  it("finds variable references in template", () => {
    const refs = findVariableReferences("Hello {{$gameName}} and {{$version}}");
    expect(refs).toContain("gameName");
    expect(refs).toContain("version");
  });

  it("returns empty array for template with no vars", () => {
    expect(findVariableReferences("Hello {{name}}")).toEqual([]);
  });
});
