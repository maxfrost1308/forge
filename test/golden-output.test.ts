import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderFullCard } from "../src/template-renderer.js";
import {
  fixtureProject,
  creatureRows,
  spellRows,
} from "./fixtures/golden/fixture-project.js";
import {
  GOLDEN,
  type GoldenEntry,
} from "./fixtures/golden/snapshots.js";

vi.mock("../src/icon-loader.js", () => ({
  resolveIconUrl: vi.fn((name: string) =>
    name ? `https://example.com/icons/${name}.svg` : null,
  ),
  getCachedIcon: vi.fn(() => null),
}));

vi.mock("../src/qr-code.js", () => ({
  generateQrSvg: vi.fn((val: string) => `<svg data-qr="${val}"></svg>`),
}));

describe("golden output: creature cards (front)", () => {
  creatureRows.forEach((row, i) => {
    it(`creature[${i}] "${row.name}" front matches golden`, () => {
      const result = renderFullCard(fixtureProject, "creature", row);
      expect(result).not.toBeNull();
      const key = `creature_front_${i}` as keyof typeof GOLDEN;
      const golden: GoldenEntry = GOLDEN[key];
      expect(result!.html).toBe(golden.html);
      expect(result!.css).toBe(golden.css);
      expect(result!.width).toBe(golden.width);
      expect(result!.height).toBe(golden.height);
      expect(result!.cardTypeId).toBe(golden.cardTypeId);
    });
  });
});

describe("golden output: creature cards (back)", () => {
  creatureRows.forEach((row, i) => {
    it(`creature[${i}] "${row.name}" back matches golden`, () => {
      const result = renderFullCard(fixtureProject, "creature", row, {
        side: "back",
      });
      expect(result).not.toBeNull();
      const key = `creature_back_${i}` as keyof typeof GOLDEN;
      const golden: GoldenEntry = GOLDEN[key];
      expect(result!.html).toBe(golden.html);
      expect(result!.css).toBe(golden.css);
      expect(result!.width).toBe(golden.width);
      expect(result!.height).toBe(golden.height);
      expect(result!.cardTypeId).toBe(golden.cardTypeId);
    });
  });
});

describe("golden output: spell cards (front)", () => {
  spellRows.forEach((row, i) => {
    it(`spell[${i}] "${row.name}" front matches golden`, () => {
      const result = renderFullCard(fixtureProject, "spell", row);
      expect(result).not.toBeNull();
      const key = `spell_front_${i}` as keyof typeof GOLDEN;
      const golden: GoldenEntry = GOLDEN[key];
      expect(result!.html).toBe(golden.html);
      expect(result!.css).toBe(golden.css);
      expect(result!.width).toBe(golden.width);
      expect(result!.height).toBe(golden.height);
      expect(result!.cardTypeId).toBe(golden.cardTypeId);
    });
  });
});

describe("golden output: spell cards (back) — null backTemplate", () => {
  spellRows.forEach((row, i) => {
    it(`spell[${i}] "${row.name}" back returns null (no backTemplate)`, () => {
      const result = renderFullCard(fixtureProject, "spell", row, {
        side: "back",
      });
      expect(result).toBeNull();
    });
  });
});

describe("golden output: edge cases", () => {
  it("unknown card type returns null", () => {
    expect(renderFullCard(fixtureProject, "nonexistent", {})).toBeNull();
  });

  it("creature back with empty row auto-resolves from project.data", () => {
    const result = renderFullCard(fixtureProject, "creature", {}, {
      side: "back",
    });
    expect(result).not.toBeNull();
    const golden: GoldenEntry = GOLDEN.creature_back_empty_row;
    expect(result!.html).toBe(golden.html);
    expect(result!.css).toBe(golden.css);
  });
});
