/**
 * project-query.js — Utility helpers for querying ForgeProject data.
 * Designed for VTT consumers and any app that needs to inspect project contents
 * without rendering cards.
 *
 * All functions are pure: they never mutate the project or its arrays.
 */

/**
 * @param {object} project
 * @returns {object[]}
 */
export function getCardTypes(project) {
  return (project && project.cardTypes) || [];
}

/**
 * Returns rows from project.data that belong to the given card type.
 * For single-type projects (rows have no _cardType field), returns all rows.
 * For multi-type projects (rows have _cardType field), filters by cardTypeId.
 *
 * @param {object} project
 * @param {string} cardTypeId
 * @returns {object[]}
 */
export function getCardsByType(project, cardTypeId) {
  const rows = (project && project.data) || [];
  if (rows.length === 0) return [];
  const hasTypeField = rows.some((r) => "_cardType" in r);
  if (!hasTypeField) return rows.slice();
  return rows.filter((r) => r._cardType === cardTypeId);
}

/**
 * Returns a single row by index within its type group, or null if out of bounds.
 *
 * @param {object} project
 * @param {string} cardTypeId
 * @param {number} index
 * @returns {object|null}
 */
export function getCard(project, cardTypeId, index) {
  const group = getCardsByType(project, cardTypeId);
  if (index < 0 || index >= group.length) return null;
  return group[index];
}

/**
 * Returns a new sorted array of rows. Does not mutate the input.
 * Uses numeric comparison when both values parse as numbers, otherwise localeCompare.
 *
 * @param {object[]} rows
 * @param {string} field
 * @param {'asc'|'desc'} [direction]
 * @returns {object[]}
 */
export function sortCards(rows, field, direction = "asc") {
  if (!rows || rows.length === 0) return [];
  const sorted = rows.slice().sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    const an = Number(av);
    const bn = Number(bv);
    let cmp;
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
 *
 * @param {object} project
 * @returns {{ name: string, cardTypeCount: number, totalCards: number, cardTypes: Array<{id: string, name: string, count: number}> }}
 */
export function getProjectSummary(project) {
  const cardTypes = getCardTypes(project);
  return {
    name: (project && project.name) || "",
    cardTypeCount: cardTypes.length,
    totalCards: ((project && project.data) || []).length,
    cardTypes: cardTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      count: getCardsByType(project, ct.id).length,
    })),
  };
}
