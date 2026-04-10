// card-type-registry-core.js — Card type validation, CSS scoping, template sanitization
// TODO: copy from card-maker (T11)

/** @param {object} cardType @returns {{ valid: boolean, errors: string[] }} */
export function validateCardType(cardType) {
  throw new Error("Not implemented — pending T11 migration");
}

/** @param {string} css @param {string} cardTypeId @returns {string} */
export function scopeCss(css, cardTypeId) {
  throw new Error("Not implemented — pending T11 migration");
}

/** @param {string} template @returns {string} */
export function sanitizeTemplate(template) {
  throw new Error("Not implemented — pending T11 migration");
}
