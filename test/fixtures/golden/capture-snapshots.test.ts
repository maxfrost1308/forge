// Run once: npx vitest run test/fixtures/golden/_capture-snapshots.ts
import { describe, it, vi } from "vitest";
import { renderFullCard } from "../../../src/template-renderer.js";
import {
  fixtureProject,
  creatureRows,
  spellRows,
} from "./fixture-project.js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

vi.mock("../../../src/icon-loader.js", () => ({
  resolveIconUrl: vi.fn((name: string) =>
    name ? `https://example.com/icons/${name}.svg` : null,
  ),
  getCachedIcon: vi.fn(() => null),
}));

vi.mock("../../../src/qr-code.js", () => ({
  generateQrSvg: vi.fn((val: string) => `<svg data-qr="${val}"></svg>`),
}));

type SnapEntry = {
  html: string;
  css: string;
  width: string;
  height: string;
  cardTypeId: string;
};

describe("capture golden snapshots", () => {
  it("generates snapshots.ts", () => {
    const entries: Record<string, SnapEntry> = {};

    function capture(
      key: string,
      cardTypeId: string,
      row: Record<string, string>,
      side?: "front" | "back",
    ) {
      const result = renderFullCard(fixtureProject, cardTypeId, row, side ? { side } : {});
      if (result !== null) {
        entries[key] = {
          html: result.html,
          css: result.css,
          width: result.width,
          height: result.height,
          cardTypeId: result.cardTypeId,
        };
      }
    }

    creatureRows.forEach((row, i) => capture(`creature_front_${i}`, "creature", row));
    creatureRows.forEach((row, i) => capture(`creature_back_${i}`, "creature", row, "back"));
    spellRows.forEach((row, i) => capture(`spell_front_${i}`, "spell", row));
    capture("creature_back_empty_row", "creature", {}, "back");

    const lines: string[] = [];
    lines.push("export interface GoldenEntry {");
    lines.push("  html: string;");
    lines.push("  css: string;");
    lines.push("  width: string;");
    lines.push("  height: string;");
    lines.push("  cardTypeId: string;");
    lines.push("}");
    lines.push("");
    lines.push("export const GOLDEN: Record<string, GoldenEntry> = {");

    for (const [key, v] of Object.entries(entries)) {
      lines.push(`  ${key}: {`);
      lines.push(`    html: ${JSON.stringify(v.html)},`);
      lines.push(`    css: ${JSON.stringify(v.css)},`);
      lines.push(`    width: ${JSON.stringify(v.width)},`);
      lines.push(`    height: ${JSON.stringify(v.height)},`);
      lines.push(`    cardTypeId: ${JSON.stringify(v.cardTypeId)},`);
      lines.push("  },");
    }

    lines.push("};");
    lines.push("");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const outPath = join(__dirname, "snapshots.ts");
    writeFileSync(outPath, lines.join("\n"), "utf-8");
    console.log(`Wrote ${Object.keys(entries).length} golden entries to ${outPath}`);
  });
});
