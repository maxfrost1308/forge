/**
 * HTML escaping utility.
 * Escapes special HTML characters to prevent XSS attacks.
 */

const ESC_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape HTML special characters in a string.
 * @param str - The string to escape
 * @returns The escaped string
 */
export function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) => ESC_MAP[c] || c);
}
