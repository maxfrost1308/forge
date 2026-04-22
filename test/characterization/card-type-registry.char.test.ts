import { describe, it, expect } from "vitest";
import {
  sanitizeTemplate,
  scopeCss,
  processCss,
  validateCardType,
  buildCardTypeFromUpload,
  buildCardTypeFromBundle,
} from "../../src/card-type-registry-core.js";

describe("sanitizeTemplate", () => {
  it("removes script tags with content", () => {
    const result = sanitizeTemplate('<div><script>alert(1)</script></div>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<!-- script removed -->");
  });

  it("removes self-closing script tags", () => {
    const result = sanitizeTemplate('<script src="evil.js"/>');
    expect(result).toContain("<!-- script removed -->");
    expect(result).not.toContain("evil.js");
  });

  it("removes inline event handlers (onclick)", () => {
    const result = sanitizeTemplate('<div onclick="alert(1)">text</div>');
    expect(result).not.toContain("onclick");
    expect(result).toContain("<div");
    expect(result).toContain(">text</div>");
  });

  it("removes inline event handlers (onmouseover)", () => {
    const result = sanitizeTemplate('<a onmouseover="hack()">link</a>');
    expect(result).not.toContain("onmouseover");
  });

  it("replaces javascript: href with about:blank", () => {
    const result = sanitizeTemplate('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
    expect(result).toContain('href="about:blank"');
  });

  it("replaces javascript: src with about:blank", () => {
    const result = sanitizeTemplate('<img src="javascript:alert(1)">');
    expect(result).toContain('src="about:blank"');
  });

  it("replaces vbscript: href with about:blank", () => {
    const result = sanitizeTemplate('<a href="vbscript:MsgBox(1)">click</a>');
    expect(result).not.toContain("vbscript:");
    expect(result).toContain('href="about:blank"');
  });

  it("passes through safe HTML unchanged", () => {
    const html = '<div class="card"><span>{{name}}</span></div>';
    expect(sanitizeTemplate(html)).toBe(html);
  });

  it("handles multiline script blocks", () => {
    const html = "<script>\nvar x = 1;\nalert(x);\n</script>";
    const result = sanitizeTemplate(html);
    expect(result).not.toContain("var x");
    expect(result).toContain("<!-- script removed -->");
  });
});

describe("scopeCss", () => {
  it("prefixes a simple selector with card type scope", () => {
    const result = scopeCss(".card { color: red; }", "hero");
    expect(result).toContain('[data-card-type="hero"] .card');
  });

  it("prefixes multiple selectors separated by comma", () => {
    const result = scopeCss("h1, h2 { font-size: 1em; }", "hero");
    expect(result).toContain('[data-card-type="hero"] h1');
    expect(result).toContain('[data-card-type="hero"] h2');
  });

  it("replaces body selector with scope only", () => {
    const result = scopeCss("body { margin: 0; }", "hero");
    expect(result).toContain('[data-card-type="hero"] {');
    expect(result).not.toContain("body");
  });

  it("replaces html selector with scope only", () => {
    const result = scopeCss("html { box-sizing: border-box; }", "hero");
    expect(result).toContain('[data-card-type="hero"] {');
  });

  it("rewrites body-prefixed selector", () => {
    const result = scopeCss("body .wrapper { display: flex; }", "hero");
    expect(result).toContain('[data-card-type="hero"] .wrapper');
  });

  it("does not double-scope already scoped selectors", () => {
    const alreadyScoped = '[data-card-type="hero"] .card { color: red; }';
    const result = scopeCss(alreadyScoped, "hero");
    expect(result).not.toContain('[data-card-type="hero"] [data-card-type="hero"]');
  });

  it("scopes selectors inside @keyframes (current behavior)", () => {
    const css = "@keyframes spin { from { transform: rotate(0); } }";
    const result = scopeCss(css, "hero");
    expect(result).toContain('[data-card-type="hero"]');
  });
});

describe("processCss", () => {
  it("scopes CSS without sanitizing when shouldSanitize is false", () => {
    const css = ".card { color: red; } .title { font-size: 1em; }";
    const result = processCss(css, "hero", false);
    expect(result).toContain('[data-card-type="hero"] .card');
    expect(result).toContain('[data-card-type="hero"] .title');
  });

  it("sanitizes and scopes CSS when shouldSanitize is true", () => {
    const css = ".card { color: red; }";
    const result = processCss(css, "hero", true);
    expect(result).toContain('[data-card-type="hero"] .card');
  });

  it("sanitizes @import when shouldSanitize is true", () => {
    const css = "@import url('evil.css'); .card { color: red; }";
    const result = processCss(css, "hero", true);
    expect(result).toContain("/* removed */");
    expect(result).not.toContain("@import url('evil.css')");
  });
});

describe("validateCardType", () => {
  it("returns valid for a well-formed card type", () => {
    const ct = {
      id: "hero",
      name: "Hero",
      fields: [{ key: "name", type: "text" }],
    };
    expect(validateCardType(ct)).toEqual({ valid: true, errors: [] });
  });

  it("returns invalid for null input", () => {
    const result = validateCardType(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("cardType must be an object");
  });

  it("returns error for missing id", () => {
    const result = validateCardType({ name: "Hero", fields: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("id"))).toBe(true);
  });

  it("returns error for missing name", () => {
    const result = validateCardType({ id: "hero", fields: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("name"))).toBe(true);
  });

  it("returns error for missing fields", () => {
    const result = validateCardType({ id: "hero", name: "Hero" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("fields"))).toBe(true);
  });

  it("returns error for invalid field type", () => {
    const result = validateCardType({
      id: "hero",
      name: "Hero",
      fields: [{ key: "x", type: "invalid_type" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("invalid"))).toBe(true);
  });

  it("returns error for field missing key", () => {
    const result = validateCardType({
      id: "hero",
      name: "Hero",
      fields: [{ type: "text" }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts all valid field types", () => {
    const validTypes = ["text", "select", "multi-select", "tags", "url", "image",
      "number", "icon", "qr", "text-long", "richtext", "background", "pdf", "computed"];
    for (const type of validTypes) {
      const result = validateCardType({
        id: "ct",
        name: "CT",
        fields: [{ key: "f", type }],
      });
      expect(result.valid).toBe(true);
    }
  });
});

describe("buildCardTypeFromUpload", () => {
  const schema = {
    id: "hero",
    name: "Hero Card",
    fields: [{ key: "name", type: "text" }],
  };

  it("returns a valid card type object", () => {
    const result = buildCardTypeFromUpload(schema, "<div>{{name}}</div>", null, "");
    expect(result.id).toBe("hero");
    expect(result.name).toBe("Hero Card");
    expect(result.fields).toEqual(schema.fields);
  });

  it("sanitizes the front template", () => {
    const front = '<div><script>alert(1)</script>{{name}}</div>';
    const result = buildCardTypeFromUpload(schema, front, null, "");
    expect(result.frontTemplate).not.toContain("<script>");
    expect(result.frontTemplate).toContain("{{name}}");
  });

  it("sanitizes the back template when provided", () => {
    const back = '<div onclick="x()">back</div>';
    const result = buildCardTypeFromUpload(schema, "<div>front</div>", back, "");
    expect(result.backTemplate).not.toContain("onclick");
  });

  it("sets backTemplate to null when not provided", () => {
    const result = buildCardTypeFromUpload(schema, "<div>front</div>", null, "");
    expect(result.backTemplate).toBeNull();
  });

  it("throws if schema is missing id", () => {
    expect(() =>
      buildCardTypeFromUpload({ name: "X", fields: [] }, "<div/>", null, "")
    ).toThrow();
  });

  it("throws if front template is empty", () => {
    expect(() =>
      buildCardTypeFromUpload(schema, "   ", null, "")
    ).toThrow("Front template cannot be empty");
  });

  it("sets default cardSize when not in schema", () => {
    const result = buildCardTypeFromUpload(schema, "<div/>", null, "");
    expect(result.cardSize).toEqual({ width: "63.5mm", height: "88.9mm" });
  });

  it("sets _sanitizeCss to true", () => {
    const result = buildCardTypeFromUpload(schema, "<div/>", null, "");
    expect(result._sanitizeCss).toBe(true);
  });

  it("applies textarea alias to text-long", () => {
    const schemaWithTextarea = {
      id: "x",
      name: "X",
      fields: [{ key: "desc", type: "textarea" }],
    };
    const result = buildCardTypeFromUpload(schemaWithTextarea, "<div/>", null, "");
    expect(result.fields[0].type).toBe("text-long");
  });
});

describe("buildCardTypeFromBundle", () => {
  const validBundle = {
    id: "spell",
    name: "Spell Card",
    fields: [{ key: "name", type: "text" }],
    frontTemplate: "<div>{{name}}</div>",
  };

  it("returns a valid card type from bundle", () => {
    const result = buildCardTypeFromBundle(validBundle);
    expect(result.id).toBe("spell");
    expect(result.name).toBe("Spell Card");
  });

  it("sanitizes template for non-built-in bundles", () => {
    const bundle = {
      ...validBundle,
      frontTemplate: '<div><script>alert(1)</script>{{name}}</div>',
    };
    const result = buildCardTypeFromBundle(bundle);
    expect(result.frontTemplate).not.toContain("<script>");
  });

  it("does NOT sanitize template for _builtIn bundles", () => {
    const bundle = {
      ...validBundle,
      frontTemplate: '<div><script>alert(1)</script>{{name}}</div>',
      _builtIn: true,
    };
    const result = buildCardTypeFromBundle(bundle);
    expect(result.frontTemplate).toContain("<script>");
  });

  it("sets _sanitizeCss false for built-in bundles", () => {
    const result = buildCardTypeFromBundle({ ...validBundle, _builtIn: true });
    expect(result._sanitizeCss).toBe(false);
  });

  it("throws if bundle is null", () => {
    expect(() => buildCardTypeFromBundle(null)).toThrow();
  });

  it("throws if bundle is missing id", () => {
    expect(() =>
      buildCardTypeFromBundle({ name: "X", fields: [], frontTemplate: "<div/>" })
    ).toThrow();
  });

  it("throws if bundle is missing frontTemplate", () => {
    expect(() =>
      buildCardTypeFromBundle({ id: "x", name: "X", fields: [] })
    ).toThrow();
  });

  it("uses bundle.styles if bundle.css not present", () => {
    const bundle = { ...validBundle, styles: ".card { color: red; }" };
    const result = buildCardTypeFromBundle(bundle);
    expect(result.css).toBe(".card { color: red; }");
  });

  it("defaults cardSize if not specified", () => {
    const result = buildCardTypeFromBundle(validBundle);
    expect(result.cardSize).toEqual({ width: "63.5mm", height: "88.9mm" });
  });

  it("preserves sampleData from bundle", () => {
    const bundle = { ...validBundle, sampleData: [{ name: "Fireball" }] };
    const result = buildCardTypeFromBundle(bundle);
    expect(result.sampleData).toEqual([{ name: "Fireball" }]);
  });
});
