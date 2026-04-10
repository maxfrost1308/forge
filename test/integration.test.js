import { describe, it, expect } from "vitest";
import { renderCard, preprocessRow, renderTemplate } from "../src/template-renderer.js";
import { hashTagColor } from "../src/color-utils.js";

describe("integration: render card from inline forge-like data", () => {
  const schema = {
    id: "test",
    name: "Test",
    cardSize: { width: "63.5mm", height: "88.9mm" },
    fields: [
      { key: "Name", type: "text", label: "Name" },
      { key: "Type", type: "select", label: "Type" },
      { key: "Tags", type: "tags", separator: "|", label: "Tags" },
    ],
    colorMapping: {
      borderColor: {
        field: "Type",
        map: { creature: "#4ade80", spell: "#60a5fa" },
        auto: true,
        default: "#888",
      },
    },
  };

  it("renders a basic card with field substitution", () => {
    const template = "<div class=\"card\">{{Name}}</div>";
    const row = { Name: "Alice" };
    const html = renderCard(template, row, schema.fields, schema);
    expect(html).toContain("Alice");
    expect(html).toContain('<div class="card">');
  });

  it("renders multi-select tags as comma-joined list", () => {
    const template = "{{Tags}}";
    const row = { Name: "Dragon", Tags: "fire|flying|rare" };
    const html = renderCard(template, row, schema.fields, schema);
    expect(html).toContain("fire");
    expect(html).toContain("flying");
    expect(html).toContain("rare");
  });

  it("escapes HTML in field values", () => {
    const template = "{{Name}}";
    const row = { Name: '<script>alert("xss")</script>' };
    const html = renderCard(template, row, schema.fields, schema);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("applies colorMapping to produce CSS variable values", () => {
    const row = { Name: "Fireball", Type: "spell" };
    const data = preprocessRow(row, schema.fields, schema);
    expect(data.borderColor).toBe("#60a5fa");
  });

  it("colorMapping auto-generates color for unmapped Type", () => {
    const row = { Name: "Potion", Type: "item" };
    const data = preprocessRow(row, schema.fields, schema, { hashTagColor });
    expect(data.borderColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("renders conditional block", () => {
    const template = '{{#eq Type "creature"}}IS_CREATURE{{/eq}}';
    const html = renderCard(template, { Name: "Wolf", Type: "creature" }, schema.fields, schema);
    expect(html).toBe("IS_CREATURE");
  });

  it("renders inverted block when field is empty", () => {
    const template = "{{^Tags}}no tags{{/Tags}}";
    const html = renderCard(template, { Name: "Wolf", Tags: "" }, schema.fields, schema);
    expect(html).toBe("no tags");
  });

  it("injects global variables", () => {
    const template = "{{Name}} from {{$universe}}";
    const html = renderCard(template, { Name: "Alice" }, schema.fields, schema, {
      globalVariables: { universe: "Wonderland" },
    });
    expect(html).toBe("Alice from Wonderland");
  });

  it("renders QR code tag", () => {
    const template = "{{{qr:Name}}}";
    const html = renderCard(template, { Name: "https://example.com" }, schema.fields, schema);
    expect(html).toMatch(/<svg/);
  });
});

describe("integration: deserialize and render from in-memory forge structure", () => {
  it("builds a project-like object and renders cards from it", async () => {
    const cardType = {
      id: "test-card",
      name: "Test Card",
      cardSize: { width: "63.5mm", height: "88.9mm" },
      fields: [
        { key: "Title", type: "text" },
        { key: "Cost", type: "number" },
      ],
      frontTemplate: "<div>{{Title}} — cost: {{Cost}}</div>",
      css: "",
      backTemplate: null,
      colorMapping: null,
    };

    const rows = [
      { Title: "Lightning Bolt", Cost: "1" },
      { Title: "Counterspell", Cost: "2" },
    ];

    const results = rows.map((row) =>
      renderCard(cardType.frontTemplate, row, cardType.fields, cardType)
    );

    expect(results[0]).toBe("<div>Lightning Bolt — cost: 1</div>");
    expect(results[1]).toBe("<div>Counterspell — cost: 2</div>");
  });
});
