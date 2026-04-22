import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IconCache } from "../src/icon-cache";

const FAKE_SVG = `<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path d="M0 0h512v512H0z"/><path d="M100 200L300 400"/></svg>`;
const CLEANED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><style>path{fill:currentColor}</style><path d="M100 200L300 400"/></svg>`;

function mockFetchOk(body = FAKE_SVG, delay = 0): typeof globalThis.fetch {
  return vi.fn(() =>
    new Promise((resolve) =>
      setTimeout(
        () => resolve(new Response(body, { status: 200 })),
        delay,
      ),
    ),
  ) as unknown as typeof globalThis.fetch;
}

function mockFetchFail(delay = 0): typeof globalThis.fetch {
  return vi.fn(() =>
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("network")), delay),
    ),
  ) as unknown as typeof globalThis.fetch;
}

function mockFetch404(delay = 0): typeof globalThis.fetch {
  return vi.fn(() =>
    new Promise((resolve) =>
      setTimeout(
        () => resolve(new Response("Not Found", { status: 404 })),
        delay,
      ),
    ),
  ) as unknown as typeof globalThis.fetch;
}

describe("IconCache", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("creates an empty cache", () => {
      const cache = new IconCache();
      expect(cache.getCached("anything")).toBe("");
    });
  });

  describe("resolveUrl", () => {
    it("passes full https URLs through unchanged", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("https://example.com/icon.svg")).toBe(
        "https://example.com/icon.svg",
      );
    });

    it("passes full http URLs through unchanged", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("http://example.com/icon.svg")).toBe(
        "http://example.com/icon.svg",
      );
    });

    it("resolves author/name to CDN URL", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("delapouite/oak")).toBe(
        "https://cdn.jsdelivr.net/gh/game-icons/icons@latest/delapouite/oak.svg",
      );
    });

    it("defaults to delapouite author for bare names", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("sword")).toBe(
        "https://cdn.jsdelivr.net/gh/game-icons/icons@latest/delapouite/sword.svg",
      );
    });

    it("strips color suffix before resolving", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("sword#ff0000")).toBe(
        "https://cdn.jsdelivr.net/gh/game-icons/icons@latest/delapouite/sword.svg",
      );
    });

    it("strips color suffix with author", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("lorc/axe#00ff00")).toBe(
        "https://cdn.jsdelivr.net/gh/game-icons/icons@latest/lorc/axe.svg",
      );
    });

    it("returns null for empty/falsy input", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("")).toBeNull();
    });

    it("trims whitespace", () => {
      const cache = new IconCache();
      expect(cache.resolveUrl("  oak  ")).toBe(
        "https://cdn.jsdelivr.net/gh/game-icons/icons@latest/delapouite/oak.svg",
      );
    });
  });

  describe("fetch", () => {
    it("fetches SVG from CDN and caches it", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();

      const svg = await cache.fetch("oak");
      expect(svg).toBe(CLEANED_SVG);
      expect(cache.getCached("oak")).toBe(CLEANED_SVG);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it("returns cached SVG on second call without fetching again", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();

      await cache.fetch("oak");
      const svg2 = await cache.fetch("oak");
      expect(svg2).toBe(CLEANED_SVG);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it("returns empty string for null resolveUrl", async () => {
      const cache = new IconCache();
      const svg = await cache.fetch("");
      expect(svg).toBe("");
    });
  });

  describe("getCached", () => {
    it("returns empty string for uncached icon", () => {
      const cache = new IconCache();
      expect(cache.getCached("nonexistent")).toBe("");
    });

    it("returns empty string for falsy input", () => {
      const cache = new IconCache();
      expect(cache.getCached("")).toBe("");
    });

    it("returns cached SVG after fetch", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();
      await cache.fetch("oak");
      expect(cache.getCached("oak")).toBe(CLEANED_SVG);
    });
  });

  describe("preload", () => {
    it("preloads multiple icons", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();

      await cache.preload(["oak", "sword", "shield"]);
      expect(cache.getCached("oak")).toBe(CLEANED_SVG);
      expect(cache.getCached("sword")).toBe(CLEANED_SVG);
      expect(cache.getCached("shield")).toBe(CLEANED_SVG);
    });

    it("deduplicates names before fetching", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();

      await cache.preload(["oak", "oak", "oak"]);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it("filters out falsy values", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();

      await cache.preload(["oak", "", "sword"]);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("clear", () => {
    it("empties the cache", async () => {
      globalThis.fetch = mockFetchOk();
      const cache = new IconCache();

      await cache.fetch("oak");
      expect(cache.getCached("oak")).toBe(CLEANED_SVG);

      cache.clear();
      expect(cache.getCached("oak")).toBe("");
    });
  });

  describe("isolation", () => {
    it("two instances do not share cached icons", async () => {
      globalThis.fetch = mockFetchOk();
      const cache1 = new IconCache();
      const cache2 = new IconCache();

      await cache1.fetch("oak");
      expect(cache1.getCached("oak")).toBe(CLEANED_SVG);
      expect(cache2.getCached("oak")).toBe("");
    });

    it("clearing one instance does not affect another", async () => {
      globalThis.fetch = mockFetchOk();
      const cache1 = new IconCache();
      const cache2 = new IconCache();

      await cache1.fetch("oak");
      await cache2.fetch("oak");

      cache1.clear();
      expect(cache1.getCached("oak")).toBe("");
      expect(cache2.getCached("oak")).toBe(CLEANED_SVG);
    });
  });

  describe("concurrency", () => {
    it("limits parallel fetches to 4", async () => {
      let peakActive = 0;
      let activeCount = 0;

      globalThis.fetch = vi.fn(() => {
        activeCount++;
        if (activeCount > peakActive) peakActive = activeCount;
        return new Promise<Response>((resolve) =>
          setTimeout(() => {
            activeCount--;
            resolve(new Response(FAKE_SVG, { status: 200 }));
          }, 50),
        );
      }) as unknown as typeof globalThis.fetch;

      const cache = new IconCache();
      const names = Array.from({ length: 10 }, (_, i) => `icon${i}`);
      await cache.preload(names);

      expect(peakActive).toBe(4);
      expect(globalThis.fetch).toHaveBeenCalledTimes(10);
    });
  });

  describe("deduplication", () => {
    it("concurrent requests for same icon resolve to same promise", async () => {
      globalThis.fetch = mockFetchOk(FAKE_SVG, 50);
      const cache = new IconCache();

      const p1 = cache.fetch("oak");
      const p2 = cache.fetch("oak");

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(r2);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });
  });

  describe("error handling", () => {
    it("returns fallback SVG on network error", async () => {
      globalThis.fetch = mockFetchFail();
      const cache = new IconCache();

      const svg = await cache.fetch("oak");
      expect(svg).toContain("<svg");
      expect(svg).toContain("oak");
    });

    it("returns fallback SVG on 404", async () => {
      globalThis.fetch = mockFetch404();
      const cache = new IconCache();

      const svg = await cache.fetch("oak");
      expect(svg).toContain("<svg");
      expect(svg).toContain("oak");
    });

    it("does not crash on error, caches fallback", async () => {
      globalThis.fetch = mockFetchFail();
      const cache = new IconCache();

      const svg = await cache.fetch("broken");
      expect(svg).toContain("<svg");
      expect(cache.getCached("broken")).toBe(svg);
    });
  });
});
