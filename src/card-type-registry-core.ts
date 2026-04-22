const VALID_FIELD_TYPES = [
  "text",
  "select",
  "multi-select",
  "tags",
  "url",
  "image",
  "number",
  "icon",
  "qr",
  "text-long",
  "richtext",
  "background",
  "pdf",
  "computed",
];

const TYPE_ALIASES: Record<string, string> = { textarea: "text-long" };

export function sanitizeTemplate(html: string): string {
  let s = html.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    "<!-- script removed -->",
  );
  s = s.replace(/<script\b[^>]*\/?>/gi, "<!-- script removed -->");
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(
    /(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    '$1="about:blank"',
  );
  s = s.replace(
    /(href|src|action)\s*=\s*(?:"vbscript:[^"]*"|'vbscript:[^']*')/gi,
    '$1="about:blank"',
  );
  return s;
}

function sanitizeCss(css: string): string {
  let s = css.replace(/@import\b[^;]+;/gi, "/* removed */");
  s = s.replace(
    /url\(\s*(['"]?)(https?:\/\/[^)'"]+)\1\s*\)/gi,
    "url(/* removed */)",
  );
  s = s.replace(
    /url\(\s*"?\s*javascript:[^)"]*"?\s*\)/gi,
    "url(/* removed */)",
  );
  s = s.replace(
    /url\(\s*'?\s*javascript:[^)']*'?\s*\)/gi,
    "url(/* removed */)",
  );
  s = s.replace(/url\(\s*"?\s*vbscript:[^)"]*"?\s*\)/gi, "url(/* removed */)");
  s = s.replace(/url\(\s*'?\s*vbscript:[^)']*'?\s*\)/gi, "url(/* removed */)");
  s = s.replace(/expression\s*\([^)]*\)/gi, "/* expression removed */");
  s = s.replace(/behavior\s*:\s*url\([^)]*\)/gi, "/* behavior removed */");
  return s;
}

export function scopeCss(css: string, cardTypeId: string): string {
  const scope = `[data-card-type="${cardTypeId}"]`;
  return css.replace(/([^{}@]+)\{/g, (match, selectorPart: string) => {
    const trimmed = selectorPart.trim();
    if (trimmed.startsWith("@") || trimmed === "") return match;
    const scoped = trimmed
      .split(",")
      .map((s) => {
        s = s.trim();
        if (!s) return s;
        if (s.includes("[data-card-type")) return s;
        if (s === "body" || s === "html") return scope;
        if (s.startsWith("body ")) return `${scope} ${s.slice(5)}`;
        if (s.startsWith("html ")) return `${scope} ${s.slice(5)}`;
        return `${scope} ${s}`;
      })
      .join(", ");
    return `${scoped} {`;
  });
}

export function processCss(css: string, cardTypeId: string, shouldSanitize: boolean): string {
  const processed = shouldSanitize ? sanitizeCss(css) : css;
  return scopeCss(processed, cardTypeId);
}

function applyTypeAliases(fields: Array<{ type?: string }>): void {
  for (const f of fields) {
    if (f.type && TYPE_ALIASES[f.type]) f.type = TYPE_ALIASES[f.type];
  }
}

function validateFields(fields: Array<{ key?: unknown; type?: unknown; options?: unknown }>): void {
  for (const f of fields) {
    if (!f.key || typeof f.key !== "string")
      throw new Error(`Field missing string "key": ${JSON.stringify(f)}`);
    if (!f.type || typeof f.type !== "string")
      throw new Error(`Field "${f.key}" missing "type".`);
    if (!VALID_FIELD_TYPES.includes(f.type)) {
      throw new Error(
        `Field "${f.key}" has invalid type "${f.type}". Valid: ${VALID_FIELD_TYPES.join(", ")}`,
      );
    }
    if (f.options !== undefined && !Array.isArray(f.options)) {
      throw new Error(
        `Field "${f.key}" — "options" must be an array if provided.`,
      );
    }
  }
}

export function validateCardType(cardType: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!cardType || typeof cardType !== "object") {
    return { valid: false, errors: ["cardType must be an object"] };
  }
  const ct = cardType as Record<string, unknown>;
  if (!ct.id || typeof ct.id !== "string")
    errors.push('Missing or invalid "id"');
  if (!ct.name || typeof ct.name !== "string")
    errors.push('Missing or invalid "name"');
  if (!ct.fields || !Array.isArray(ct.fields)) {
    errors.push('Missing or invalid "fields" array');
  } else {
    try {
      validateFields(ct.fields);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildCardTypeFromUpload(
  schema: Record<string, unknown>,
  frontTemplate: string,
  backTemplate: string | null,
  css: string,
): Record<string, unknown> {
  if (!schema.id || typeof schema.id !== "string")
    throw new Error('Schema must have a string "id" field.');
  if (!schema.name || typeof schema.name !== "string")
    throw new Error('Schema must have a string "name" field.');
  if (!schema.fields || !Array.isArray(schema.fields))
    throw new Error('Schema must have a "fields" array.');

  applyTypeAliases(schema.fields);
  validateFields(schema.fields);

  if (!frontTemplate.trim()) throw new Error("Front template cannot be empty.");

  return {
    id: schema.id,
    name: schema.name,
    description: schema.description || "",
    cardSize: schema.cardSize || { width: "63.5mm", height: "88.9mm" },
    fields: schema.fields,
    colorMapping: schema.colorMapping || null,
    aggregations: schema.aggregations || null,
    frontTemplate: sanitizeTemplate(frontTemplate),
    backTemplate: backTemplate ? sanitizeTemplate(backTemplate) : null,
    css: css || "",
    sampleData: null,
    _sanitizeCss: true,
  };
}

export function buildCardTypeFromBundle(bundle: unknown): Record<string, unknown> {
  if (!bundle || typeof bundle !== "object")
    throw new Error("Invalid bundle: expected a JSON object.");
  const b = bundle as Record<string, unknown>;
  if (!b.id || typeof b.id !== "string")
    throw new Error('Bundle must have a string "id" field.');
  if (!b.name || typeof b.name !== "string")
    throw new Error('Bundle must have a string "name" field.');
  if (!b.fields || !Array.isArray(b.fields))
    throw new Error('Bundle must have a "fields" array.');
  if (!b.frontTemplate || typeof b.frontTemplate !== "string")
    throw new Error('Bundle must have a "frontTemplate" string.');

  applyTypeAliases(b.fields);
  validateFields(b.fields);

  const isBuiltIn = !!b._builtIn;

  return {
    id: b.id,
    name: b.name,
    description: b.description || "",
    cardSize: b.cardSize || { width: "63.5mm", height: "88.9mm" },
    fields: b.fields,
    colorMapping: b.colorMapping || null,
    aggregations: b.aggregations || null,
    frontTemplate: isBuiltIn
      ? b.frontTemplate
      : sanitizeTemplate(b.frontTemplate as string),
    backTemplate: b.backTemplate
      ? isBuiltIn
        ? b.backTemplate
        : sanitizeTemplate(b.backTemplate as string)
      : null,
    css: (b.styles as string) || (b.css as string) || "",
    sampleData: b.sampleData || null,
    _builtIn: isBuiltIn,
    _sanitizeCss: !isBuiltIn,
  };
}
