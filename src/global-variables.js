/**
 * Global variable management — pure logic, no state imports.
 * Variables use {{$varName}} syntax in templates.
 */

/**
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateVariableName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Variable name is required" };
  }
  if (!/^\w+$/.test(name)) {
    return {
      valid: false,
      error: "Variable name must contain only letters, digits, and underscores",
    };
  }
  if (/^\d/.test(name)) {
    return { valid: false, error: "Variable name must not start with a digit" };
  }
  return { valid: true };
}

/**
 * Inject global variables into template data with '$' prefix.
 * @param {Record<string, unknown>} data
 * @param {Record<string, string>} variables
 * @returns {Record<string, unknown>}
 */
export function injectVariables(data, variables) {
  if (!variables || typeof variables !== "object") return data;
  const keys = Object.keys(variables);
  if (keys.length === 0) return data;

  const merged = { ...data };
  for (const key of keys) {
    merged[`$${key}`] = variables[key];
  }
  return merged;
}

/**
 * Find all {{$varName}} references in a template string.
 * @param {string} template
 * @returns {string[]}
 */
export function findVariableReferences(template) {
  if (!template || typeof template !== "string") return [];
  const refs = new Set();
  const re = /\{\{\$(\w+)\}\}/g;
  let m;
  while ((m = re.exec(template)) !== null) {
    refs.add(m[1]);
  }
  return [...refs];
}
