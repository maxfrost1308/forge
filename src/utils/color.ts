/**
 * Color utility for deterministic tag coloring.
 */

const AUTO_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#78716c",
];

/**
 * Get a consistent color for a value based on its name hash.
 * Uses the curated AUTO_COLORS palette for deterministic results.
 * @param value - The string to hash
 * @returns CSS hex color string
 */
export function hashTagColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length];
}
