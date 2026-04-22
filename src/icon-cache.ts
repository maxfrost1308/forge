import type { IconQueueItem } from "./types";

const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/game-icons/icons@latest/";
const MAX_CONCURRENT = 4;

export class IconCache {
  private svgCache = new Map<string, string>();
  private pendingFetches = new Map<string, Promise<string>>();
  private queue: IconQueueItem[] = [];
  private activeCount = 0;

  resolveUrl(nameOrUrl: string): string | null {
    if (!nameOrUrl) return null;
    nameOrUrl = nameOrUrl.trim();

    if (
      nameOrUrl.startsWith("http://") ||
      nameOrUrl.startsWith("https://")
    ) {
      return nameOrUrl;
    }

    let name = nameOrUrl;
    if (name.includes("#")) {
      name = name.split("#")[0];
    }
    if (!name.includes("/")) {
      name = `delapouite/${name}`;
    }

    return `${CDN_BASE}${name}.svg`;
  }

  private cacheKey(nameOrUrl: string): string {
    return nameOrUrl
      .trim()
      .toLowerCase()
      .replace(/\.svg$/, "");
  }

  async fetch(nameOrUrl: string): Promise<string> {
    const key = this.cacheKey(nameOrUrl);

    if (this.svgCache.has(key)) return this.svgCache.get(key)!;
    if (this.pendingFetches.has(key))
      return this.pendingFetches.get(key)!;

    const url = this.resolveUrl(nameOrUrl);
    if (!url) return "";

    const promise = this.enqueue(url, key);
    this.pendingFetches.set(key, promise);
    return promise;
  }

  getCached(nameOrUrl: string): string {
    if (!nameOrUrl) return "";
    return this.svgCache.get(this.cacheKey(nameOrUrl)) ?? "";
  }

  async preload(names: string[]): Promise<void> {
    const unique = [
      ...new Set(names.filter(Boolean).map((n) => n.trim())),
    ];
    await Promise.all(unique.map((n) => this.fetch(n)));
  }

  clear(): void {
    this.svgCache.clear();
    this.pendingFetches.clear();
  }

  private enqueue(url: string, key: string): Promise<string> {
    return new Promise((resolve) => {
      this.queue.push({ url, key, resolve });
      this.drain();
    });
  }

  private drain(): void {
    while (
      this.activeCount < MAX_CONCURRENT &&
      this.queue.length > 0
    ) {
      const job = this.queue.shift()!;
      this.activeCount++;
      this.doFetch(job).finally(() => {
        this.activeCount--;
        this.drain();
      });
    }
  }

  private async doFetch({ url, key, resolve }: IconQueueItem): Promise<void> {
    try {
      const res = await globalThis.fetch(url);
      if (!res.ok) {
        const fallback = this.makeFallback(key);
        this.svgCache.set(key, fallback);
        this.pendingFetches.delete(key);
        resolve(fallback);
        return;
      }
      let svg = await res.text();

      svg = svg
        .replace(/<\?xml[^>]*\?>/gi, "")
        .replace(/<!DOCTYPE[^>]*>/gi, "")
        .trim();

      svg = svg.replace(/<path[^>]*d="M0 0h512v512H0z"[^>]*\/?>/, "");

      svg = svg.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
        let cleaned = attrs.replace(/\s(width|height)="[^"]*"/gi, "");
        if (!/viewBox/i.test(cleaned)) {
          cleaned += ' viewBox="0 0 512 512"';
        }
        return `<svg${cleaned}><style>path{fill:currentColor}</style>`;
      });

      this.svgCache.set(key, svg);
      this.pendingFetches.delete(key);
      resolve(svg);
    } catch {
      const fallback = this.makeFallback(key);
      this.svgCache.set(key, fallback);
      this.pendingFetches.delete(key);
      resolve(fallback);
    }
  }

  private makeFallback(key: string): string {
    const label = key.split("/").pop() ?? "?";
    return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="64" fill="#e0e0e0"/>
    <text x="256" y="280" text-anchor="middle" font-size="64" fill="#999" font-family="system-ui">${label}</text>
  </svg>`;
  }
}
