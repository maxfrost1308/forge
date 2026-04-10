// Card type validation, CSS scoping, and template sanitization.
// Pure logic — no DOM APIs, no state imports.

const VALID_FIELD_TYPES = [
  'text', 'select', 'multi-select', 'tags', 'url', 'image', 'number',
  'icon', 'qr', 'text-long', 'richtext', 'background', 'computed',
];

const TYPE_ALIASES = { textarea: 'text-long' };

export function sanitizeTemplate(html) {
  let s = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<!-- script removed -->');
  s = s.replace(/<script\b[^>]*\/?>/gi, '<!-- script removed -->');
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1="about:blank"');
  s = s.replace(/(href|src|action)\s*=\s*(?:"vbscript:[^"]*"|'vbscript:[^']*')/gi, '$1="about:blank"');
  return s;
}

function sanitizeCss(css) {
  let s = css.replace(/@import\b[^;]+;/gi, '/* removed */');
  s = s.replace(/url\(\s*(['"]?)(https?:\/\/[^)'"]+)\1\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*"?\s*javascript:[^)"]*"?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*'?\s*javascript:[^)']*'?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*"?\s*vbscript:[^)"]*"?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/url\(\s*'?\s*vbscript:[^)']*'?\s*\)/gi, 'url(/* removed */)');
  s = s.replace(/expression\s*\([^)]*\)/gi, '/* expression removed */');
  s = s.replace(/behavior\s*:\s*url\([^)]*\)/gi, '/* behavior removed */');
  return s;
}

export function scopeCss(css, cardTypeId) {
  const scope = `[data-card-type="${cardTypeId}"]`;
  return css.replace(/([^{}@]+)\{/g, (match, selectorPart) => {
    const trimmed = selectorPart.trim();
    if (trimmed.startsWith('@') || trimmed === '') return match;
    const scoped = trimmed
      .split(',')
      .map((s) => {
        s = s.trim();
        if (!s) return s;
        if (s.includes('[data-card-type')) return s;
        if (s === 'body' || s === 'html') return scope;
        if (s.startsWith('body ')) return `${scope} ${s.slice(5)}`;
        if (s.startsWith('html ')) return `${scope} ${s.slice(5)}`;
        return `${scope} ${s}`;
      })
      .join(', ');
    return `${scoped} {`;
  });
}

export function processCss(css, cardTypeId, shouldSanitize) {
  const processed = shouldSanitize ? sanitizeCss(css) : css;
  return scopeCss(processed, cardTypeId);
}

function applyTypeAliases(fields) {
  for (const f of fields) {
    if (f.type && TYPE_ALIASES[f.type]) f.type = TYPE_ALIASES[f.type];
  }
}

function validateFields(fields) {
  for (const f of fields) {
    if (!f.key || typeof f.key !== 'string') throw new Error(`Field missing string "key": ${JSON.stringify(f)}`);
    if (!f.type || typeof f.type !== 'string') throw new Error(`Field "${f.key}" missing "type".`);
    if (!VALID_FIELD_TYPES.includes(f.type)) {
      throw new Error(`Field "${f.key}" has invalid type "${f.type}". Valid: ${VALID_FIELD_TYPES.join(', ')}`);
    }
    if (f.options !== undefined && !Array.isArray(f.options)) {
      throw new Error(`Field "${f.key}" — "options" must be an array if provided.`);
    }
  }
}

/**
 * Validate a card type object. Returns { valid, errors }.
 * @param {object} cardType
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCardType(cardType) {
  const errors = [];
  if (!cardType || typeof cardType !== 'object') {
    return { valid: false, errors: ['cardType must be an object'] };
  }
  if (!cardType.id || typeof cardType.id !== 'string') errors.push('Missing or invalid "id"');
  if (!cardType.name || typeof cardType.name !== 'string') errors.push('Missing or invalid "name"');
  if (!cardType.fields || !Array.isArray(cardType.fields)) {
    errors.push('Missing or invalid "fields" array');
  } else {
    try {
      validateFields(cardType.fields);
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildCardTypeFromUpload(schema, frontTemplate, backTemplate, css) {
  if (!schema.id || typeof schema.id !== 'string') throw new Error('Schema must have a string "id" field.');
  if (!schema.name || typeof schema.name !== 'string') throw new Error('Schema must have a string "name" field.');
  if (!schema.fields || !Array.isArray(schema.fields)) throw new Error('Schema must have a "fields" array.');

  applyTypeAliases(schema.fields);
  validateFields(schema.fields);

  if (!frontTemplate.trim()) throw new Error('Front template cannot be empty.');

  return {
    id: schema.id,
    name: schema.name,
    description: schema.description || '',
    cardSize: schema.cardSize || { width: '63.5mm', height: '88.9mm' },
    fields: schema.fields,
    colorMapping: schema.colorMapping || null,
    aggregations: schema.aggregations || null,
    frontTemplate: sanitizeTemplate(frontTemplate),
    backTemplate: backTemplate ? sanitizeTemplate(backTemplate) : null,
    css: css || '',
    sampleData: null,
    _sanitizeCss: true,
  };
}

export function buildCardTypeFromBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('Invalid bundle: expected a JSON object.');
  if (!bundle.id || typeof bundle.id !== 'string') throw new Error('Bundle must have a string "id" field.');
  if (!bundle.name || typeof bundle.name !== 'string') throw new Error('Bundle must have a string "name" field.');
  if (!bundle.fields || !Array.isArray(bundle.fields)) throw new Error('Bundle must have a "fields" array.');
  if (!bundle.frontTemplate || typeof bundle.frontTemplate !== 'string')
    throw new Error('Bundle must have a "frontTemplate" string.');

  applyTypeAliases(bundle.fields);
  validateFields(bundle.fields);

  const isBuiltIn = !!bundle._builtIn;

  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description || '',
    cardSize: bundle.cardSize || { width: '63.5mm', height: '88.9mm' },
    fields: bundle.fields,
    colorMapping: bundle.colorMapping || null,
    aggregations: bundle.aggregations || null,
    frontTemplate: isBuiltIn ? bundle.frontTemplate : sanitizeTemplate(bundle.frontTemplate),
    backTemplate: bundle.backTemplate
      ? isBuiltIn ? bundle.backTemplate : sanitizeTemplate(bundle.backTemplate)
      : null,
    css: bundle.styles || bundle.css || '',
    sampleData: bundle.sampleData || null,
    _builtIn: isBuiltIn,
    _sanitizeCss: !isBuiltIn,
  };
}
