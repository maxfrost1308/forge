import { describe, it, expect } from "vitest";
import {
  getCardTypes,
  getCardsByType,
  getCard,
  sortCards,
  getProjectSummary,
} from "../src/project-query.js";

const singleTypeProject = {
  name: "My Game",
  cardTypes: [{ id: "monsters", name: "Monsters" }],
  data: [
    { name: "Dragon", power: "10" },
    { name: "Goblin", power: "2" },
    { name: "Troll", power: "5" },
  ],
  globalVariables: {},
};

const multiTypeProject = {
  name: "Multi Game",
  cardTypes: [
    { id: "monsters", name: "Monsters" },
    { id: "spells", name: "Spells" },
  ],
  data: [
    { _cardType: "monsters", name: "Dragon" },
    { _cardType: "spells", name: "Fireball" },
    { _cardType: "monsters", name: "Goblin" },
    { _cardType: "spells", name: "Ice Storm" },
  ],
};

describe("getCardTypes", () => {
  it("returns cardTypes array", () => {
    expect(getCardTypes(singleTypeProject)).toEqual([
      { id: "monsters", name: "Monsters" },
    ]);
  });

  it("returns empty array for empty project", () => {
    expect(getCardTypes({})).toEqual([]);
  });

  it("returns empty array for null/undefined", () => {
    expect(getCardTypes(null)).toEqual([]);
    expect(getCardTypes(undefined)).toEqual([]);
  });
});

describe("getCardsByType", () => {
  it("returns all rows for single-type project (no _cardType field)", () => {
    const result = getCardsByType(singleTypeProject, "monsters");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Dragon");
  });

  it("filters rows by _cardType for multi-type project", () => {
    const monsters = getCardsByType(multiTypeProject, "monsters");
    expect(monsters).toHaveLength(2);
    expect(monsters.every((r) => r._cardType === "monsters")).toBe(true);

    const spells = getCardsByType(multiTypeProject, "spells");
    expect(spells).toHaveLength(2);
    expect(spells.every((r) => r._cardType === "spells")).toBe(true);
  });

  it("returns empty array for unknown cardTypeId in multi-type project", () => {
    expect(getCardsByType(multiTypeProject, "nonexistent")).toEqual([]);
  });

  it("returns empty array when project has no data", () => {
    expect(getCardsByType({ cardTypes: [{ id: "a" }] }, "a")).toEqual([]);
  });

  it("returns empty array for empty project", () => {
    expect(getCardsByType({}, "x")).toEqual([]);
  });

  it("does not mutate the original data array", () => {
    const original = singleTypeProject.data.slice();
    getCardsByType(singleTypeProject, "monsters");
    expect(singleTypeProject.data).toEqual(original);
  });
});

describe("getCard", () => {
  it("returns the row at the given index within the type group", () => {
    const card = getCard(singleTypeProject, "monsters", 1);
    expect(card.name).toBe("Goblin");
  });

  it("returns null for out-of-bounds index", () => {
    expect(getCard(singleTypeProject, "monsters", 99)).toBeNull();
    expect(getCard(singleTypeProject, "monsters", -1)).toBeNull();
  });

  it("returns null for empty project", () => {
    expect(getCard({}, "monsters", 0)).toBeNull();
  });

  it("returns correct card in multi-type project", () => {
    const card = getCard(multiTypeProject, "spells", 0);
    expect(card.name).toBe("Fireball");
  });
});

describe("sortCards", () => {
  const rows = [
    { name: "Troll", power: "5" },
    { name: "Dragon", power: "10" },
    { name: "Goblin", power: "2" },
  ];

  it("sorts strings ascending", () => {
    const sorted = sortCards(rows, "name");
    expect(sorted.map((r) => r.name)).toEqual(["Dragon", "Goblin", "Troll"]);
  });

  it("sorts strings descending", () => {
    const sorted = sortCards(rows, "name", "desc");
    expect(sorted.map((r) => r.name)).toEqual(["Troll", "Goblin", "Dragon"]);
  });

  it("sorts numeric strings numerically (not lexicographically)", () => {
    const sorted = sortCards(rows, "power");
    expect(sorted.map((r) => r.power)).toEqual(["2", "5", "10"]);
  });

  it("sorts numeric strings descending", () => {
    const sorted = sortCards(rows, "power", "desc");
    expect(sorted.map((r) => r.power)).toEqual(["10", "5", "2"]);
  });

  it("does not mutate the input array", () => {
    const original = rows.map((r) => r.name);
    sortCards(rows, "name");
    expect(rows.map((r) => r.name)).toEqual(original);
  });

  it("returns empty array for empty/null input", () => {
    expect(sortCards([], "name")).toEqual([]);
    expect(sortCards(null, "name")).toEqual([]);
  });
});

describe("getProjectSummary", () => {
  it("returns correct summary for single-type project", () => {
    const summary = getProjectSummary(singleTypeProject);
    expect(summary.name).toBe("My Game");
    expect(summary.cardTypeCount).toBe(1);
    expect(summary.totalCards).toBe(3);
    expect(summary.cardTypes).toEqual([
      { id: "monsters", name: "Monsters", count: 3 },
    ]);
  });

  it("returns correct per-type counts for multi-type project", () => {
    const summary = getProjectSummary(multiTypeProject);
    expect(summary.cardTypeCount).toBe(2);
    expect(summary.totalCards).toBe(4);
    const monsterEntry = summary.cardTypes.find((ct) => ct.id === "monsters");
    const spellEntry = summary.cardTypes.find((ct) => ct.id === "spells");
    expect(monsterEntry.count).toBe(2);
    expect(spellEntry.count).toBe(2);
  });

  it("handles empty project gracefully", () => {
    const summary = getProjectSummary({});
    expect(summary.name).toBe("");
    expect(summary.cardTypeCount).toBe(0);
    expect(summary.totalCards).toBe(0);
    expect(summary.cardTypes).toEqual([]);
  });
});
