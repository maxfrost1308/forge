import { describe, it, expect, vi } from "vitest";
import {
  preprocessRow,
  renderTemplate,
  renderCard,
  renderFullCard,
  evaluateExpression,
  validateComputedFields,
} from "../src/template-renderer.js";
import { hashTagColor } from "../src/color-utils.js";

vi.mock("../src/icon-loader.js", () => ({
  resolveIconUrl: vi.fn((name) =>
    name ? `https://example.com/icons/${name}.svg` : null,
  ),
  getCachedIcon: vi.fn(() => null),
}));

vi.mock("../src/qr-code.js", () => ({
  generateQrSvg: vi.fn((val) => `<svg data-qr="${val}"></svg>`),
}));

describe("preprocessRow", () => {
  const fields = [
    { key: "name", type: "text", label: "Name" },
    { key: "tags", type: "tags", separator: "|" },
    { key: "types", type: "multi-select", separator: "," },
    { key: "rarity", type: "select" },
  ];

  it("passes through simple text values", () => {
    const result = preprocessRow({ name: "Fern" }, fields, null);
    expect(result.name).toBe("Fern");
  });

  it("trims string values", () => {
    const result = preprocessRow({ name: "  Fern  " }, fields, null);
    expect(result.name).toBe("Fern");
  });

  it("splits tags fields into arrays using separator", () => {
    const result = preprocessRow({ tags: "fire|water|earth" }, fields, null);
    expect(result.tags).toEqual(["fire", "water", "earth"]);
  });

  it("splits multi-select fields using custom separator", () => {
    const result = preprocessRow({ types: "warrior,mage,rogue" }, fields, null);
    expect(result.types).toEqual(["warrior", "mage", "rogue"]);
  });

  it("returns empty string for empty multi-select", () => {
    const result = preprocessRow({ tags: "" }, fields, null);
    expect(result.tags).toBe("");
  });

  it("adds _lower variant for string fields", () => {
    const result = preprocessRow({ name: "Fire Dragon" }, fields, null);
    expect(result.name_lower).toBe("fire-dragon");
  });

  it("fills missing fields with empty string", () => {
    const result = preprocessRow({}, fields, null);
    expect(result.name).toBe("");
  });

  it("carries forward extra CSV columns not in schema", () => {
    const result = preprocessRow(
      { name: "Fern", extra_col: "bonus" },
      fields,
      null,
    );
    expect(result.extra_col).toBe("bonus");
  });

  it("applies colorMapping from card type", () => {
    const cardType = {
      colorMapping: {
        color: {
          field: "rarity",
          map: { common: "#aaa", rare: "#gold" },
          default: "#fff",
        },
      },
    };
    const result = preprocessRow({ rarity: "rare" }, fields, cardType);
    expect(result.color).toBe("#gold");
  });

  it("uses colorMapping default when source value not in map", () => {
    const cardType = {
      colorMapping: {
        color: { field: "rarity", map: { common: "#aaa" }, default: "#fff" },
      },
    };
    const result = preprocessRow({ rarity: "legendary" }, fields, cardType);
    expect(result.color).toBe("#fff");
  });

  it("colorMapping with auto:true generates hash color for unmapped values", () => {
    const cardType = {
      colorMapping: { color: { field: "rarity", auto: true, default: "#fff" } },
    };
    const result = preprocessRow({ rarity: "legendary" }, fields, cardType, {
      hashTagColor,
    });
    expect(result.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.color).not.toBe("#fff");
  });

  describe("pdf field type", () => {
    it("resolves pdf field via resolveAssetReference when getAsset returns match", () => {
      const fields = [{ key: "front_pdf", type: "pdf", label: "Front" }];
      const getAsset = (key) =>
        key === "cards.pdf#3"
          ? { data: "data:image/png;base64,abc", type: "image/png", size: 100 }
          : null;
      const result = preprocessRow(
        { front_pdf: "asset:cards.pdf#3" },
        fields,
        null,
        { getAsset },
      );
      expect(result.front_pdf).toBe("data:image/png;base64,abc");
    });

    it("passes through pdf field value when no getAsset match", () => {
      const fields = [{ key: "front_pdf", type: "pdf", label: "Front" }];
      const getAsset = () => null;
      const result = preprocessRow(
        { front_pdf: "asset:cards.pdf#3" },
        fields,
        null,
        { getAsset },
      );
      expect(typeof result.front_pdf).toBe("string");
    });

    it("pdf field without #N passes through as-is to getAsset", () => {
      const fields = [{ key: "front_pdf", type: "pdf", label: "Front" }];
      let capturedKey = null;
      const getAsset = (key) => {
        capturedKey = key;
        return null;
      };
      preprocessRow({ front_pdf: "asset:cards.pdf" }, fields, null, {
        getAsset,
      });
      expect(typeof capturedKey).toBe("string");
    });
  });
});

describe("renderTemplate", () => {
  it("substitutes {{field}} with HTML-escaped value", () => {
    const result = renderTemplate("Hello {{name}}!", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("escapes HTML in {{field}} substitution", () => {
    const result = renderTemplate("{{content}}", {
      content: '<script>alert("xss")</script>',
    });
    expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("renders {{{field}}} without escaping (raw)", () => {
    const result = renderTemplate("{{{html}}}", { html: "<b>bold</b>" });
    expect(result).toBe("<b>bold</b>");
  });

  it("returns empty string for undefined fields", () => {
    const result = renderTemplate("{{missing}}", {});
    expect(result).toBe("");
  });

  it("renders conditional block when truthy", () => {
    const result = renderTemplate("{{#name}}has name{{/name}}", {
      name: "Fern",
    });
    expect(result).toBe("has name");
  });

  it("does not render conditional block when falsy", () => {
    const result = renderTemplate("{{#name}}has name{{/name}}", { name: "" });
    expect(result).toBe("");
  });

  it("iterates over array with {{#field}}{{.}}{{/field}}", () => {
    const result = renderTemplate("{{#tags}}<span>{{.}}</span>{{/tags}}", {
      tags: ["fire", "water"],
    });
    expect(result).toBe("<span>fire</span><span>water</span>");
  });

  it("renders {{^field}} inverted block when value is empty", () => {
    const result = renderTemplate("{{^name}}no name{{/name}}", { name: "" });
    expect(result).toBe("no name");
  });

  it("renders {{{icon:field}}} as img tag", () => {
    const result = renderTemplate("{{{icon:iconName}}}", { iconName: "sword" });
    expect(result).toContain("<img");
    expect(result).toContain("icon-img");
    expect(result).toContain("sword");
  });

  it("renders {{{qr:field}}} as SVG", () => {
    const result = renderTemplate("{{{qr:url}}}", {
      url: "https://example.com",
    });
    expect(result).toContain("<svg");
  });

  it("handles multiple substitutions", () => {
    const result = renderTemplate("{{a}} and {{b}}", { a: "foo", b: "bar" });
    expect(result).toBe("foo and bar");
  });
});

describe("{{#eq}} equality conditional", () => {
  it("renders block when field equals expected value", () => {
    const result = renderTemplate('{{#eq type "creature"}}is creature{{/eq}}', {
      type: "creature",
    });
    expect(result).toBe("is creature");
  });

  it("does not render block when field does not equal expected value", () => {
    const result = renderTemplate('{{#eq type "creature"}}is creature{{/eq}}', {
      type: "spell",
    });
    expect(result).toBe("");
  });

  it("supports numeric comparison", () => {
    const result = renderTemplate('{{#eq cost "3"}}costs 3{{/eq}}', {
      cost: 3,
    });
    expect(result).toBe("costs 3");
  });
});

describe("{{#gt}} / {{#lt}} / {{#gte}} / {{#lte}} / {{#neq}} numeric comparisons", () => {
  it("{{#gt}} renders when field > value", () => {
    const result = renderTemplate("{{#gt attack 5}}ELITE{{/gt}}", {
      attack: "7",
    });
    expect(result).toBe("ELITE");
  });

  it("{{#gt}} does not render when field <= value", () => {
    const result = renderTemplate("{{#gt attack 5}}ELITE{{/gt}}", {
      attack: "3",
    });
    expect(result).toBe("");
  });

  it("{{#neq}} renders when field does not equal value", () => {
    const result = renderTemplate('{{#neq type "spell"}}not a spell{{/neq}}', {
      type: "creature",
    });
    expect(result).toBe("not a spell");
  });
});

describe("{{#and}} / {{#or}} / {{#not}} boolean combinators", () => {
  it("{{#and}} renders when both fields are truthy", () => {
    const result = renderTemplate("{{#and type attack}}combat{{/and}}", {
      type: "creature",
      attack: "5",
    });
    expect(result).toBe("combat");
  });

  it("{{#or}} renders when either field is truthy", () => {
    const result = renderTemplate("{{#or attack defense}}has stats{{/or}}", {
      attack: "",
      defense: "3",
    });
    expect(result).toBe("has stats");
  });

  it("{{#not}} renders when field is falsy", () => {
    const result = renderTemplate("{{#not attack}}no attack{{/not}}", {
      attack: "",
    });
    expect(result).toBe("no attack");
  });
});

describe("String helpers", () => {
  it("{{upper field}} renders UPPERCASE", () => {
    expect(renderTemplate("{{upper type}}", { type: "creature" })).toBe(
      "CREATURE",
    );
  });

  it("{{lower field}} renders lowercase", () => {
    expect(renderTemplate("{{lower name}}", { name: "DRAGON" })).toBe("dragon");
  });

  it("{{capitalize field}} capitalizes each word", () => {
    expect(renderTemplate("{{capitalize name}}", { name: "fire dragon" })).toBe(
      "Fire Dragon",
    );
  });

  it("{{truncate field N}} truncates with ...", () => {
    expect(
      renderTemplate("{{truncate desc 10}}", {
        desc: "A very long description here",
      }),
    ).toBe("A very lon...");
  });
});

describe("renderCard", () => {
  const fields = [
    { key: "name", type: "text" },
    { key: "tags", type: "tags", separator: "|" },
  ];

  it("preprocesses and renders a full card", () => {
    const result = renderCard(
      "{{name}}: {{tags}}",
      { name: "Fern", tags: "plant|green" },
      fields,
      null,
    );
    expect(result).toBe("Fern: plant, green");
  });

  it("handles missing fields gracefully", () => {
    const result = renderCard("{{name}}", {}, fields, null);
    expect(result).toBe("");
  });

  it("injects global variables into rendered output", () => {
    const result = renderCard(
      "{{name}} - {{$gameName}}",
      { name: "Fern" },
      fields,
      null,
      {
        globalVariables: { gameName: "Dragon Wars" },
      },
    );
    expect(result).toBe("Fern - Dragon Wars");
  });
});

describe("renderFullCard", () => {
  const project = {
    name: "Test Game",
    cardTypes: [
      {
        id: "monsters",
        name: "Monsters",
        cardSize: { width: "63.5mm", height: "88.9mm" },
        fields: [{ key: "name", type: "text" }],
        frontTemplate: "<div>{{name}}</div>",
        backTemplate: "<div class='back'>Back</div>",
        css: ".back { background: red; }",
      },
    ],
    data: [],
    globalVariables: {},
    assets: {},
    fonts: {},
  };

  it("renders front side by default", () => {
    const result = renderFullCard(project, "monsters", { name: "Dragon" });
    expect(result).not.toBeNull();
    expect(result.html).toBe("<div>Dragon</div>");
    expect(result.width).toBe("63.5mm");
    expect(result.height).toBe("88.9mm");
    expect(result.cardTypeId).toBe("monsters");
  });

  it("renders back side", () => {
    const result = renderFullCard(project, "monsters", {}, { side: "back" });
    expect(result).not.toBeNull();
    expect(result.html).toContain("Back");
  });

  it("returns null for unknown card type", () => {
    expect(renderFullCard(project, "nope", {})).toBeNull();
  });

  it("returns null when back template is missing", () => {
    const noBack = {
      ...project,
      cardTypes: [{ ...project.cardTypes[0], backTemplate: null }],
    };
    expect(renderFullCard(noBack, "monsters", {}, { side: "back" })).toBeNull();
  });

  it("scopes CSS with data-card-type selector", () => {
    const result = renderFullCard(project, "monsters", { name: "X" });
    expect(result.css).toContain('[data-card-type="monsters"]');
  });

  it("injects @font-face rules from project.fonts", () => {
    const withFonts = {
      ...project,
      fonts: {
        "custom.woff2": {
          data: "data:font/woff2;base64,abc",
          type: "font/woff2",
          family: "CustomFont",
        },
      },
    };
    const result = renderFullCard(withFonts, "monsters", { name: "X" });
    expect(result.css).toContain('@font-face{font-family:"CustomFont"');
    expect(result.css).toContain("data:font/woff2;base64,abc");
  });

  it("resolves {{{asset:...}}} in CSS", () => {
    const withAsset = {
      ...project,
      assets: {
        "bg.png": { data: "data:image/png;base64,xyz", type: "image/png" },
      },
      cardTypes: [
        {
          ...project.cardTypes[0],
          css: ".card { background: url({{{asset:bg.png}}}); }",
        },
      ],
    };
    const result = renderFullCard(withAsset, "monsters", { name: "X" });
    expect(result.css).toContain("data:image/png;base64,xyz");
    expect(result.css).not.toContain("{{{asset:");
  });

  it("resolves fonts via getAsset fallback", () => {
    const withFontAsset = {
      ...project,
      fonts: {
        "my.woff2": {
          data: "data:font/woff2;base64,fontdata",
          type: "font/woff2",
          family: "MyFont",
        },
      },
      cardTypes: [
        {
          ...project.cardTypes[0],
          css: ".card { src: url({{{asset:my.woff2}}}); }",
        },
      ],
    };
    const result = renderFullCard(withFontAsset, "monsters", { name: "X" });
    expect(result.css).toContain("data:font/woff2;base64,fontdata");
  });
});

describe("evaluateExpression", () => {
  it("evaluates simple addition", () => {
    expect(
      evaluateExpression("attack + defense", { attack: "3", defense: "5" }),
    ).toBe(8);
  });

  it("handles parentheses", () => {
    expect(
      evaluateExpression("(attack + defense) * 2", {
        attack: "3",
        defense: "5",
      }),
    ).toBe(16);
  });

  it("handles division by zero", () => {
    expect(evaluateExpression("attack / 0", { attack: "10" })).toBe(0);
  });
});

describe("validateComputedFields", () => {
  it("returns no errors for valid computed fields", () => {
    const fields = [
      { key: "attack", type: "text" },
      { key: "total", type: "computed", expression: "attack + defense" },
    ];
    expect(validateComputedFields(fields)).toEqual([]);
  });

  it("returns error when computed field references another computed field", () => {
    const fields = [
      { key: "attack", type: "text" },
      { key: "total", type: "computed", expression: "attack + bonus" },
      { key: "bonus", type: "computed", expression: "attack * 2" },
    ];
    const errors = validateComputedFields(fields);
    expect(errors.length).toBeGreaterThan(0);
  });
});
