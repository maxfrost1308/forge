/**
 * project-query.ts — Utility helpers for querying ForgeProject data.
 * Designed for VTT consumers and any app that needs to inspect project contents
 * without rendering cards.
 *
 * All functions are pure: they never mutate the project or its arrays.
 */

export function getCardTypes(project: Record<string, unknown>): unknown[] {
  return (project && (project.cardTypes as unknown[])) || [];
}

/**
 * Returns rows from project.data that belong to the given card type.
 * For single-type projects (rows have no _type field), returns all rows.
 * For multi-type projects (rows have _type field), filters by cardTypeId.
 */
export function getCardsByType(
  project: Record<string, unknown>,
  cardTypeId: string,
): Record<string, unknown>[] {
  const rows = ((project && project.data) as Record<string, unknown>[]) || [];
  if (rows.length === 0) return [];
  const hasTypeField = rows.some((r) => "_type" in r);
  if (!hasTypeField) return rows.slice();
  return rows.filter((r) => r._type === cardTypeId);
}

/**
 * Returns a single row by index within its type group, or null if out of bounds.
 */
export function getCard(
  project: Record<string, unknown>,
  cardTypeId: string,
  index: number,
): Record<string, unknown> | null {
  const group = getCardsByType(project, cardTypeId);
  if (index < 0 || index >= group.length) return null;
  return group[index];
}

/**
 * Returns a new sorted array of rows. Does not mutate the input.
 * Uses numeric comparison when both values parse as numbers, otherwise localeCompare.
 */
export function sortCards(
  rows: Record<string, unknown>[],
  field: string,
  direction: "asc" | "desc" = "asc",
): Record<string, unknown>[] {
  if (!rows || rows.length === 0) return [];
  const sorted = rows.slice().sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    const an = Number(av);
    const bn = Number(bv);
    let cmp: number;
    if (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") {
      cmp = an - bn;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return direction === "desc" ? -cmp : cmp;
  });
  return sorted;
}

/**
 * Returns a summary of the project without rendering any cards.
 */
export function getProjectSummary(project: Record<string, unknown>): {
  name: string;
  cardTypeCount: number;
  totalCards: number;
  cardTypes: Array<{ id: string; name: string; count: number }>;
} {
  const cardTypes = getCardTypes(project) as Array<{ id: string; name: string }>;
  return {
    name: (project && (project.name as string)) || "",
    cardTypeCount: cardTypes.length,
    totalCards: ((project && project.data) as unknown[] || []).length,
    cardTypes: cardTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      count: getCardsByType(project, ct.id).length,
    })),
  };
}
