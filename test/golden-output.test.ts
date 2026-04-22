import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderFullCard } from "../src/template-renderer.js";
import { Project } from "../src/project.ts";
import { CardType } from "../src/card-type.ts";
import { Card } from "../src/card.ts";
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

// Regression gate: will catch divergence when rendering is ported from JS→TS
describe("Golden output equivalence (old vs new API)", () => {
  describe("creature cards (front)", () => {
    creatureRows.forEach((row, i) => {
      it(`creature[${i}] "${row.name}" front: new API === old API`, () => {
        const oldResult = renderFullCard(fixtureProject, "creature", row);

        const project = Project.from(fixtureProject);
        const cardType = new CardType(project, project.getCardType("creature")!);
        const card = new Card(cardType, row, i);
        const newResult = card.render({ side: "front" });

        expect(oldResult).not.toBeNull();
        expect(newResult).not.toBeNull();
        expect(newResult!.html).toBe(oldResult!.html);
        expect(newResult!.css).toBe(oldResult!.css);
        expect(newResult!.width).toBe(oldResult!.width);
        expect(newResult!.height).toBe(oldResult!.height);
      });
    });
  });

  describe("creature cards (back)", () => {
    creatureRows.forEach((row, i) => {
      it(`creature[${i}] "${row.name}" back: new API === old API`, () => {
        const oldResult = renderFullCard(fixtureProject, "creature", row, {
          side: "back",
        });

        const project = Project.from(fixtureProject);
        const cardType = new CardType(project, project.getCardType("creature")!);
        const card = new Card(cardType, row, i);
        const newResult = card.render({ side: "back" });

        expect(oldResult).not.toBeNull();
        expect(newResult).not.toBeNull();
        expect(newResult!.html).toBe(oldResult!.html);
        expect(newResult!.css).toBe(oldResult!.css);
        expect(newResult!.width).toBe(oldResult!.width);
        expect(newResult!.height).toBe(oldResult!.height);
      });
    });
  });

  describe("spell cards (front)", () => {
    spellRows.forEach((row, i) => {
      it(`spell[${i}] "${row.name}" front: new API === old API`, () => {
        const oldResult = renderFullCard(fixtureProject, "spell", row);

        const project = Project.from(fixtureProject);
        const cardType = new CardType(project, project.getCardType("spell")!);
        const card = new Card(cardType, row, i);
        const newResult = card.render({ side: "front" });

        expect(oldResult).not.toBeNull();
        expect(newResult).not.toBeNull();
        expect(newResult!.html).toBe(oldResult!.html);
        expect(newResult!.css).toBe(oldResult!.css);
        expect(newResult!.width).toBe(oldResult!.width);
        expect(newResult!.height).toBe(oldResult!.height);
      });
    });
  });

  describe("spell cards (back) — null backTemplate", () => {
    spellRows.forEach((row, i) => {
      it(`spell[${i}] "${row.name}" back: both APIs return null`, () => {
        const oldResult = renderFullCard(fixtureProject, "spell", row, {
          side: "back",
        });

        const project = Project.from(fixtureProject);
        const cardType = new CardType(project, project.getCardType("spell")!);
        const card = new Card(cardType, row, i);
        const newResult = card.render({ side: "back" });

        expect(oldResult).toBeNull();
        expect(newResult).toBeNull();
      });
    });
  });

  describe("edge cases", () => {
    it("creature back with empty row: new API === old API", () => {
      const oldResult = renderFullCard(fixtureProject, "creature", {}, {
        side: "back",
      });

      const project = Project.from(fixtureProject);
      const cardType = new CardType(project, project.getCardType("creature")!);
      const card = new Card(cardType, {}, 0);
      const newResult = card.render({ side: "back" });

      expect(oldResult).not.toBeNull();
      expect(newResult).not.toBeNull();
      expect(newResult!.html).toBe(oldResult!.html);
      expect(newResult!.css).toBe(oldResult!.css);
      expect(newResult!.width).toBe(oldResult!.width);
      expect(newResult!.height).toBe(oldResult!.height);
    });
  });
});
