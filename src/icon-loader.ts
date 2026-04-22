// Copyright (c) 2026 maxfrost1308
// Licensed under AGPL-3.0. See LICENSE in the project root.

import type { IconQueueItem } from './types.js';

const svgCache = new Map<string, string>();
const pendingFetches = new Map<string, Promise<string>>();
const MAX_CONCURRENT = 4;
let activeCount = 0;
const queue: IconQueueItem[] = [];

export function resolveIconUrl(
  nameOrUrl: string,
  _fgColor = '000000',
  _bgColor = 'ffffff',
): string | null {
  if (!nameOrUrl) return null;
  nameOrUrl = nameOrUrl.trim();

  if (nameOrUrl.startsWith('http://') || nameOrUrl.startsWith('https://')) {
    return nameOrUrl;
  }

  let name = nameOrUrl;
  if (name.includes('#')) {
    name = name.split('#')[0];
  }

  if (!name.includes('/')) {
    name = `delapouite/${name}`;
  }

  return `https://cdn.jsdelivr.net/gh/game-icons/icons@latest/${name}.svg`;
}

function cacheKey(nameOrUrl: string): string {
  return nameOrUrl
    .trim()
    .toLowerCase()
    .replace(/\.svg$/, '');
}

export async function fetchIcon(
  nameOrUrl: string,
  options: { fg?: string; bg?: string } = {},
): Promise<string> {
  const key = cacheKey(nameOrUrl);

  if (svgCache.has(key)) return svgCache.get(key)!;
  if (pendingFetches.has(key)) return pendingFetches.get(key)!;

  const url = resolveIconUrl(nameOrUrl, options.fg, options.bg);
  if (!url) return '';

  const promise = enqueue(url, key);
  pendingFetches.set(key, promise);
  return promise;
}

function enqueue(url: string, key: string): Promise<string> {
  return new Promise((resolve) => {
    queue.push({ url, key, resolve });
    drain();
  });
}

function drain(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    activeCount++;
    doFetch(job).finally(() => {
      activeCount--;
      drain();
    });
  }
}

async function doFetch({ url, key, resolve }: IconQueueItem): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const fallback = makeFallbackSvg(key);
      svgCache.set(key, fallback);
      pendingFetches.delete(key);
      resolve(fallback);
      return;
    }
    let svg = await res.text();

    svg = svg
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .trim();

    svg = svg.replace(/<path[^>]*d="M0 0h512v512H0z"[^>]*\/?>/, '');

    svg = svg.replace(/<svg([^>]*)>/, (_match: string, attrs: string) => {
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

function makeFallbackSvg(key: string): string {
  const label = key.split('/').pop() || '?';
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="64" fill="#e0e0e0"/>
    <text x="256" y="280" text-anchor="middle" font-size="64" fill="#999" font-family="system-ui">${label}</text>
  </svg>`;
}

export async function preloadIcons(names: string[]): Promise<void> {
  const unique = [...new Set(names.filter(Boolean).map((n) => n.trim()))];
  await Promise.all(unique.map((n) => fetchIcon(n)));
}

export function getCachedIcon(nameOrUrl: string): string {
  if (!nameOrUrl) return '';
  return svgCache.get(cacheKey(nameOrUrl)) || '';
}

export function clearCache(): void {
  svgCache.clear();
  pendingFetches.clear();
}
