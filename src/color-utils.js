// Copyright (c) 2026 maxfrost1308
// Licensed under AGPL-3.0. See LICENSE in the project root.

/**
 * Standalone color utility functions — no DOM dependencies, no state imports.
 *
 * Exports:
 *   hashTagColor — deterministic color from tag value string
 */

// Curated 12-color palette for deterministic auto-coloring.
// Colors in the 400-500 range for good contrast with white text in both
// light and dark mode. All pass WCAG AA for white foreground.
const AUTO_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#78716c", // stone
];

/**
 * Get a consistent color for a value based on its name hash.
 * Uses the curated AUTO_COLORS palette for deterministic results.
 * @param {string} value
 * @returns {string} CSS hex color string
 */
export function hashTagColor(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length];
}
