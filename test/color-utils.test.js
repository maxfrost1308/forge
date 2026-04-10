import { describe, it, expect } from "vitest";
import { hashTagColor } from "../src/color-utils.js";

describe("hashTagColor", () => {
  it("returns a CSS hex color string", () => {
    expect(hashTagColor("fire")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("is deterministic for the same input", () => {
    expect(hashTagColor("dragon")).toBe(hashTagColor("dragon"));
  });

  it("returns different colors for different inputs", () => {
    const colors = new Set(["fire", "water", "earth", "wind", "light", "dark"].map(hashTagColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("handles empty string without throwing", () => {
    expect(() => hashTagColor("")).not.toThrow();
  });
});
