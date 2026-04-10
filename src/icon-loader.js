// Copyright (c) 2026 maxfrost1308
// Licensed under AGPL-3.0. See LICENSE in the project root.
/**
 * Icon Loader — fetches and caches SVG icons via the jsdelivr CDN
 * (serving the game-icons/icons GitHub repo with proper CORS headers).
 *
 * jsdelivr CDN URL pattern:
 *   https://cdn.jsdelivr.net/gh/game-icons/icons@latest/<author>/<icon-name>.svg
 *
 * Raw GitHub SVGs are monochrome; color is applied post-fetch via CSS
 * (fill: currentColor) so icons inherit the text color of their parent element.
 *
 * To avoid rate-limiting when rendering 200+ cards, this module:
 *  - Caches every fetched SVG in memory (Map)
 *  - Deduplicates concurrent requests for the same icon
 *  - Uses a concurrency limiter (max 4 parallel fetches)
 *  - Provides a preload function to batch-fetch unique icons before render
 */

/**
 * @typedef {object} IconQueueItem
 * @property {string} url
 * @property {string} key
 * @property {(value: string) => void} resolve
 */

/** @type {Map<string, string>} iconName → SVG string (inline-ready) */
const svgCache = new Map();
/** @type {Map<string, Promise<string>>} iconName → Promise<string> */
const pendingFetches = new Map();
const MAX_CONCURRENT = 4;
let activeCount = 0;
/** @type {IconQueueItem[]} */
const queue = [];

/**
 * Resolve an icon name to a full jsdelivr CDN URL.
 * Accepts:
 *  - Full URL: https://... (passed through as-is)
 *  - Short name: "delapouite/oak" or just "oak" (defaults to delapouite author)
 *  - Name with color suffix: "oak#ff0000" (suffix stripped; coloring is CSS-based)
 */
/**
 * @param {string} nameOrUrl
 * @param {string} [_fgColor] - unused, kept for API compat
 * @param {string} [_bgColor] - unused, kept for API compat
 * @returns {string|null}
 */
export function resolveIconUrl(nameOrUrl, _fgColor = '000000', _bgColor = 'ffffff') {
  if (!nameOrUrl) return null;
  nameOrUrl = nameOrUrl.trim();

  // Already a full URL
  if (nameOrUrl.startsWith('http://') || nameOrUrl.startsWith('https://')) {
    return nameOrUrl;
  }

  // Strip optional color suffix: "icon-name#hexcolor"
  // (color is applied post-fetch via CSS currentColor, not via URL)
  let name = nameOrUrl;
  if (name.includes('#')) {
    name = name.split('#')[0];
  }

  // Default author if not specified
  if (!name.includes('/')) {
    name = `delapouite/${name}`;
  }

  return `https://cdn.jsdelivr.net/gh/game-icons/icons@latest/${name}.svg`;
}

/**
 * Normalize an icon reference to a cache key.
 * @param {string} nameOrUrl
 * @returns {string}
 */
function cacheKey(nameOrUrl) {
  return nameOrUrl
    .trim()
    .toLowerCase()
    .replace(/\.svg$/, '');
}

/**
 * Fetch a single SVG icon with concurrency limiting.
 * Returns the SVG markup string (suitable for inline use).
 */
/**
 * @param {string} nameOrUrl
 * @param {{ fg?: string, bg?: string }} [options]
 * @returns {Promise<string>}
 */
export async function fetchIcon(nameOrUrl, options = {}) {
  const key = cacheKey(nameOrUrl);

  // Return from cache
  if (svgCache.has(key)) return /** @type {string} */ (svgCache.get(key));

  // Return in-flight request
  if (pendingFetches.has(key)) return /** @type {Promise<string>} */ (pendingFetches.get(key));

  const url = resolveIconUrl(nameOrUrl, options.fg, options.bg);
  if (!url) return '';

  const promise = enqueue(url, key);
  pendingFetches.set(key, promise);
  return promise;
}

/**
 * @param {string} url
 * @param {string} key
 * @returns {Promise<string>}
 */
function enqueue(url, key) {
  return new Promise((resolve) => {
    queue.push({ url, key, resolve });
    drain();
  });
}

function drain() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const job = /** @type {IconQueueItem} */ (queue.shift());
    activeCount++;
    doFetch(job).finally(() => {
      activeCount--;
      drain();
    });
  }
}

/**
 * @param {IconQueueItem} job
 */
async function doFetch({ url, key, resolve }) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Return a fallback placeholder on failure
      const fallback = makeFallbackSvg(key);
      svgCache.set(key, fallback);
      pendingFetches.delete(key);
      resolve(fallback);
      return;
    }
    let svg = await res.text();

    // Strip XML declaration and doctype if present
    svg = svg
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .trim();

    // Strip background rectangle (may have fill or other attrs)
    svg = svg.replace(/<path[^>]*d="M0 0h512v512H0z"[^>]*\/?>/, '');

    // Make it inline-friendly: remove fixed width/height, ensure viewBox,
    // and inject currentColor fill so icon inherits text color from parent
    svg = svg.replace(/<svg([^>]*)>/, (match, attrs) => {
      let cleaned = attrs.replace(/\s(width|height)="[^"]*"/gi, '');
      if (!/viewBox/i.test(cleaned)) {
        cleaned += ' viewBox="0 0 512 512"';
      }
      return `<svg${cleaned}><style>path{fill:currentColor}</style>`;
    });

    svgCache.set(key, svg);
    pendingFetches.delete(key);
    resolve(svg);
  } catch {
    const fallback = makeFallbackSvg(key);
    svgCache.set(key, fallback);
    pendingFetches.delete(key);
    resolve(fallback);
  }
}

/**
 * @param {string} key
 * @returns {string}
 */
function makeFallbackSvg(key) {
  const label = key.split('/').pop() || '?';
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="64" fill="#e0e0e0"/>
    <text x="256" y="280" text-anchor="middle" font-size="64" fill="#999" font-family="system-ui">${label}</text>
  </svg>`;
}

/**
 * Preload a list of icon names/URLs. Returns when all are cached.
 * Use this before rendering many cards to avoid waterfall requests.
 */
/**
 * @param {string[]} names
 * @returns {Promise<void>}
 */
export async function preloadIcons(names) {
  const unique = [...new Set(names.filter(Boolean).map((n) => n.trim()))];
  await Promise.all(unique.map((n) => fetchIcon(n)));
}

/**
 * Get a cached SVG synchronously (returns '' if not yet loaded).
 */
/**
 * @param {string} nameOrUrl
 * @returns {string}
 */
export function getCachedIcon(nameOrUrl) {
  if (!nameOrUrl) return '';
  return svgCache.get(cacheKey(nameOrUrl)) || '';
}

/**
 * Clear the icon cache.
 */
export function clearCache() {
  svgCache.clear();
  pendingFetches.clear();
}
