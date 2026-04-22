/**
 * Global variable management — pure logic, no state imports.
 * Variables use {{$varName}} syntax in templates.
 */

export function validateVariableName(name: string): { valid: boolean; error?: string } {
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
 */
export function injectVariables(
  data: Record<string, unknown>,
  variables: Record<string, string>,
): Record<string, unknown> {
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
 */
export function findVariableReferences(template: string): string[] {
  if (!template || typeof template !== "string") return [];
  const refs = new Set<string>();
  const re = /\{\{\$(\w+)\}\}/g;
  let m;
  while ((m = re.exec(template)) !== null) {
    refs.add(m[1]);
  }
  return [...refs];
}
