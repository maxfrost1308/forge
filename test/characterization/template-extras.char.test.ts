import { describe, it, expect, vi } from "vitest";
import {
  resolveAssetReference,
  preprocessCssAssets,
  detectFontFormat,
  escapeCssFontName,
  getAutoColorVars,
} from "../../src/template-renderer.js";

describe("resolveAssetReference", () => {
  it("returns empty string for falsy value", () => {
    expect(resolveAssetReference("")).toBe("");
    expect(resolveAssetReference(null as unknown as string)).toBe("");
  });

  it("passes through https URLs unchanged", () => {
    expect(resolveAssetReference("https://example.com/img.png")).toBe(
      "https://example.com/img.png"
    );
  });

  it("passes through http URLs unchanged", () => {
    expect(resolveAssetReference("http://example.com/img.png")).toBe(
      "http://example.com/img.png"
    );
  });

  it("resolves asset: prefix by calling getAssetFn", () => {
    const assetData = "data:image/png;base64,ABC";
    const getAsset = vi.fn().mockReturnValue({ data: assetData });
    const result = resolveAssetReference("asset:hero.png", getAsset);
    expect(result).toBe(assetData);
    expect(getAsset).toHaveBeenCalledWith("hero.png");
  });

  it("falls back to image/ prefix lookup when direct lookup fails", () => {
    const assetData = "data:image/png;base64,XYZ";
    const getAsset = vi.fn((name: string) =>
      name === "image/hero.png" ? { data: assetData } : null
    );
    const result = resolveAssetReference("hero.png", getAsset);
    expect(result).toBe(assetData);
  });

  it("returns placeholder for missing asset with extension", () => {
    const getAsset = vi.fn().mockReturnValue(null);
    const result = resolveAssetReference("missing.png", getAsset);
    expect(result).toContain("data:");
  });

  it("returns value as-is for reference without extension and no asset found", () => {
    const getAsset = vi.fn().mockReturnValue(null);
    const result = resolveAssetReference("some-token", getAsset);
    expect(result).toBe("some-token");
  });

  it("uses default no-op getAssetFn when none provided", () => {
    const result = resolveAssetReference("missing.png");
    expect(result).toContain("data:");
  });
});

describe("preprocessCssAssets", () => {
  it("replaces {{{asset:filename}}} with asset data", () => {
    const getAsset = vi.fn().mockReturnValue({ data: "data:image/png;base64,ABC" });
    const css = "background: url({{{asset:bg.png}}})";
    const result = preprocessCssAssets(css, getAsset);
    expect(result).toContain("data:image/png;base64,ABC");
    expect(result).not.toContain("{{{asset:");
  });

  it("returns css unchanged when no asset patterns found", () => {
    const css = ".card { color: red; }";
    const result = preprocessCssAssets(css);
    expect(result).toBe(css);
  });

  it("returns null/undefined css as-is", () => {
    expect(preprocessCssAssets(null as unknown as string)).toBeNull();
    expect(preprocessCssAssets("")).toBeFalsy();
  });

  it("replaces with placeholder for missing asset", () => {
    const getAsset = vi.fn().mockReturnValue(null);
    const css = "background: url({{{asset:missing.png}}})";
    const result = preprocessCssAssets(css, getAsset);
    expect(result).toContain("data:");
    expect(result).not.toContain("{{{asset:");
  });
});

describe("detectFontFormat", () => {
  it("detects otf as opentype", () => {
    expect(detectFontFormat("MyFont.otf")).toBe("opentype");
  });

  it("detects woff as woff", () => {
    expect(detectFontFormat("MyFont.woff")).toBe("woff");
  });

  it("detects woff2 as woff2", () => {
    expect(detectFontFormat("MyFont.woff2")).toBe("woff2");
  });

  it("detects ttf as truetype (default)", () => {
    expect(detectFontFormat("MyFont.ttf")).toBe("truetype");
  });

  it("returns truetype for unknown extension", () => {
    expect(detectFontFormat("MyFont.eot")).toBe("truetype");
  });

  it("handles filename with no extension", () => {
    expect(detectFontFormat("MyFont")).toBe("truetype");
  });

  it("is case-insensitive for extension", () => {
    expect(detectFontFormat("MyFont.OTF")).toBe("opentype");
    expect(detectFontFormat("MyFont.WOFF2")).toBe("woff2");
  });

  it("handles empty string", () => {
    expect(detectFontFormat("")).toBe("truetype");
  });
});

describe("escapeCssFontName", () => {
  it("passes through normal font name unchanged", () => {
    expect(escapeCssFontName("Open Sans")).toBe("Open Sans");
  });

  it("escapes double quotes", () => {
    expect(escapeCssFontName('My"Font')).toBe('My\\"Font');
  });

  it("escapes backslashes", () => {
    expect(escapeCssFontName("My\\Font")).toBe("My\\\\Font");
  });

  it("handles empty string", () => {
    expect(escapeCssFontName("")).toBe("");
  });
});

describe("getAutoColorVars", () => {
  it("returns empty object when cardType has no colorMapping", () => {
    const row = { rarity: "rare" };
    const cardType = { id: "hero", name: "Hero", fields: [] };
    expect(getAutoColorVars(row, cardType)).toEqual({});
  });

  it("returns empty object when cardType is null/undefined", () => {
    expect(getAutoColorVars({ rarity: "rare" }, null as unknown as Record<string, unknown>)).toEqual({});
  });

  it("maps field value to color via static map", () => {
    const row = { rarity: "rare" };
    const cardType = {
      colorMapping: {
        rarity: {
          field: "rarity",
          map: { rare: "#9b59b6" },
        },
      },
    };
    const result = getAutoColorVars(row, cardType);
    expect(result["--cm-rarity"]).toBe("#9b59b6");
  });

  it("uses default color when value not in map", () => {
    const row = { rarity: "unknown" };
    const cardType = {
      colorMapping: {
        rarity: {
          field: "rarity",
          map: { rare: "#9b59b6" },
          default: "#cccccc",
        },
      },
    };
    const result = getAutoColorVars(row, cardType);
    expect(result["--cm-rarity"]).toBe("#cccccc");
  });

  it("calls hashTagColorFn when auto is set and no map match", () => {
    const row = { tag: "fire" };
    const cardType = {
      colorMapping: {
        tag: { field: "tag", auto: true },
      },
    };
    const hashFn = vi.fn().mockReturnValue("#ff4400");
    const result = getAutoColorVars(row, cardType, hashFn);
    expect(hashFn).toHaveBeenCalledWith("fire");
    expect(result["--cm-tag"]).toBe("#ff4400");
  });

  it("skips variable when color resolves to empty string", () => {
    const row = { rarity: "unknown" };
    const cardType = {
      colorMapping: {
        rarity: { field: "rarity", map: {} },
      },
    };
    const result = getAutoColorVars(row, cardType);
    expect(result).not.toHaveProperty("--cm-rarity");
  });

  it("handles array field value by using first element", () => {
    const row = { tags: ["fire", "water"] };
    const cardType = {
      colorMapping: {
        tags: {
          field: "tags",
          map: { fire: "#ff0000" },
        },
      },
    };
    const result = getAutoColorVars(row, cardType);
    expect(result["--cm-tags"]).toBe("#ff0000");
  });
});
