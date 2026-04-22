import { describe, it, expect } from "vitest";
import { generateQrSvg } from "../src/qr-code.js";

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
    expect(generateQrSvg("test")).toContain('xmlns="http://www.w3.org/2000/svg"');
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

  it("snapshot: known input produces expected SVG structure", () => {
    expect(generateQrSvg("HELLO WORLD")).toMatchSnapshot();
  });
});
