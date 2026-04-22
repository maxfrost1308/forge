import { describe, it, expect } from "vitest";
import { findVariableReferences } from "../../src/global-variables.js";

describe("findVariableReferences", () => {
  it("finds a single variable reference", () => {
    const refs = findVariableReferences("Hello {{$gameName}}");
    expect(refs).toEqual(["gameName"]);
  });

  it("finds multiple distinct variable references", () => {
    const refs = findVariableReferences("{{$title}} by {{$author}}");
    expect(refs).toContain("title");
    expect(refs).toContain("author");
    expect(refs).toHaveLength(2);
  });

  it("deduplicates repeated references", () => {
    const refs = findVariableReferences("{{$x}} and {{$x}} again {{$x}}");
    expect(refs).toEqual(["x"]);
  });

  it("returns empty array for template with no variable references", () => {
    expect(findVariableReferences("Hello {{name}} world")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(findVariableReferences("")).toEqual([]);
  });

  it("returns empty array for null input", () => {
    expect(findVariableReferences(null as unknown as string)).toEqual([]);
  });

  it("returns empty array for non-string input", () => {
    expect(findVariableReferences(42 as unknown as string)).toEqual([]);
  });

  it("handles underscore in variable name", () => {
    const refs = findVariableReferences("{{$game_name}}");
    expect(refs).toContain("game_name");
  });

  it("handles numeric suffix in variable name", () => {
    const refs = findVariableReferences("{{$var1}}");
    expect(refs).toContain("var1");
  });

  it("does not match $var without double-brace syntax", () => {
    const refs = findVariableReferences("$gameName in plain text");
    expect(refs).toEqual([]);
  });
});
