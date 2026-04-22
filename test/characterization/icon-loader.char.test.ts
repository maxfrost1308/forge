import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveIconUrl,
  fetchIcon,
  getCachedIcon,
  preloadIcons,
  clearCache,
} from "../../src/icon-loader.js";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/game-icons/icons@latest";

describe("resolveIconUrl", () => {
  it("returns null for empty string", () => {
    expect(resolveIconUrl("")).toBeNull();
  });

  it("returns null for falsy input", () => {
    expect(resolveIconUrl(null as unknown as string)).toBeNull();
  });

  it("passes through https URLs unchanged", () => {
    const url = "https://example.com/icon.svg";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("passes through http URLs unchanged", () => {
    const url = "http://example.com/icon.svg";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("resolves short name to CDN URL with default author", () => {
    expect(resolveIconUrl("oak")).toBe(
      `${CDN_BASE}/delapouite/oak.svg`
    );
  });

  it("resolves author/name to CDN URL", () => {
    expect(resolveIconUrl("lorc/sword")).toBe(
      `${CDN_BASE}/lorc/sword.svg`
    );
  });

  it("strips color suffix from short name", () => {
    expect(resolveIconUrl("oak#ff0000")).toBe(
      `${CDN_BASE}/delapouite/oak.svg`
    );
  });

  it("strips color suffix from author/name", () => {
    expect(resolveIconUrl("lorc/sword#00ff00")).toBe(
      `${CDN_BASE}/lorc/sword.svg`
    );
  });

  it("trims whitespace before processing", () => {
    expect(resolveIconUrl("  oak  ")).toBe(
      `${CDN_BASE}/delapouite/oak.svg`
    );
  });

  it("ignores color parameters (API compat)", () => {
    expect(resolveIconUrl("oak", "ff0000", "ffffff")).toBe(
      `${CDN_BASE}/delapouite/oak.svg`
    );
  });
});

describe("getCachedIcon", () => {
  beforeEach(() => clearCache());

  it("returns empty string when icon not cached", () => {
    expect(getCachedIcon("oak")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(getCachedIcon("")).toBe("");
  });

  it("returns empty string for falsy input", () => {
    expect(getCachedIcon(null as unknown as string)).toBe("");
  });

  it("returns cached SVG after fetchIcon", async () => {
    const fakeSvg = '<svg viewBox="0 0 512 512"><path d="M0 0"/></svg>';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"><path d="M0 0"/></svg>`,
    }));

    await fetchIcon("lorc/axe");
    const cached = getCachedIcon("lorc/axe");
    expect(cached).toContain("<svg");
    vi.unstubAllGlobals();
  });
});

describe("clearCache", () => {
  it("clears cached icons", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"></svg>`,
    }));

    await fetchIcon("lorc/shield");
    expect(getCachedIcon("lorc/shield")).not.toBe("");
    clearCache();
    expect(getCachedIcon("lorc/shield")).toBe("");
    vi.unstubAllGlobals();
  });
});

describe("fetchIcon", () => {
  beforeEach(() => clearCache());
  afterEach(() => vi.unstubAllGlobals());

  it("returns SVG string from fetch on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"><path d="M10 10"/></svg>`,
    }));

    const result = await fetchIcon("lorc/bow");
    expect(result).toContain("<svg");
  });

  it("returns fallback SVG on fetch failure (non-ok response)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "",
    }));

    const result = await fetchIcon("lorc/nonexistent");
    expect(result).toContain("<svg");
    expect(result).toContain("viewBox");
  });

  it("returns fallback SVG when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await fetchIcon("lorc/unavailable");
    expect(result).toContain("<svg");
  });

  it("returns cached result on second call without fetching again", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"></svg>`,
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchIcon("lorc/cached-test");
    await fetchIcon("lorc/cached-test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("injects currentColor style into SVG", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg width="512" height="512" viewBox="0 0 512 512"><path d="M0 0"/></svg>`,
    }));

    const result = await fetchIcon("lorc/colored");
    expect(result).toContain("currentColor");
  });

  it("strips width and height attributes from SVG", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg width="512" height="512" viewBox="0 0 512 512"></svg>`,
    }));

    const result = await fetchIcon("lorc/sized");
    expect(result).not.toMatch(/\bwidth="512"/);
    expect(result).not.toMatch(/\bheight="512"/);
  });
});

describe("preloadIcons", () => {
  beforeEach(() => clearCache());
  afterEach(() => vi.unstubAllGlobals());

  it("resolves when all icons are fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"></svg>`,
    }));

    await expect(preloadIcons(["lorc/sword", "lorc/axe"])).resolves.toBeUndefined();
  });

  it("deduplicates icon names", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"></svg>`,
    });
    vi.stubGlobal("fetch", mockFetch);

    await preloadIcons(["lorc/sword", "lorc/sword", "lorc/sword"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("filters out empty/falsy values", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<svg viewBox="0 0 512 512"></svg>`,
    });
    vi.stubGlobal("fetch", mockFetch);

    await preloadIcons(["", null as unknown as string, "lorc/bow"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
