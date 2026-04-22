import { describe, it, expect } from "vitest";
import { validateProject } from "../../src/project-format.js";

function makeMinimalProject() {
  return {
    name: "Test",
    cardTypes: [
      {
        id: "hero",
        name: "Hero",
        fields: [{ key: "name", type: "text" }],
        frontTemplate: "<div>{{name}}</div>",
      },
    ],
    defaultCardType: "hero",
    data: [],
    assets: {},
    fonts: {},
    globalVariables: {},
  };
}

describe("validateProject", () => {
  it("returns valid for minimal project with cardTypes array", () => {
    const result = validateProject(makeMinimalProject());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid for null project", () => {
    const result = validateProject(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Project is null or undefined");
  });

  it("returns invalid when no cardType and no cardTypes", () => {
    const result = validateProject({ name: "Test", data: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("cardType"))).toBe(true);
  });

  it("returns error when cardTypes[0] missing id", () => {
    const project = makeMinimalProject();
    delete (project.cardTypes[0] as Record<string, unknown>).id;
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("missing id"))).toBe(true);
  });

  it("returns error when cardTypes[0] missing fields", () => {
    const project = makeMinimalProject();
    delete (project.cardTypes[0] as Record<string, unknown>).fields;
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("fields"))).toBe(true);
  });

  it("returns error when cardTypes[0] missing frontTemplate (and no editorData)", () => {
    const project = makeMinimalProject();
    delete (project.cardTypes[0] as Record<string, unknown>).frontTemplate;
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("frontTemplate"))).toBe(true);
  });

  it("accepts missing frontTemplate when editorData is present", () => {
    const project = {
      ...makeMinimalProject(),
      editorData: { something: true },
    };
    delete (project.cardTypes[0] as Record<string, unknown>).frontTemplate;
    const result = validateProject(project);
    expect(result.valid).toBe(true);
  });

  it("validates single cardType (legacy format)", () => {
    const project = {
      cardType: {
        id: "hero",
        name: "Hero",
        fields: [{ key: "name", type: "text" }],
        frontTemplate: "<div>{{name}}</div>",
      },
      data: [],
    };
    const result = validateProject(project);
    expect(result.valid).toBe(true);
  });

  it("returns error for legacy format missing cardType.id", () => {
    const project = {
      cardType: {
        name: "Hero",
        fields: [{ key: "name", type: "text" }],
        frontTemplate: "<div/>",
      },
      data: [],
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("cardType.id"))).toBe(true);
  });

  it("validates multiple cardTypes without errors", () => {
    const project = {
      cardTypes: [
        { id: "a", fields: [{ key: "x", type: "text" }], frontTemplate: "<div/>" },
        { id: "b", fields: [{ key: "y", type: "text" }], frontTemplate: "<div/>" },
      ],
    };
    const result = validateProject(project);
    expect(result.valid).toBe(true);
  });

  it("collects errors from multiple cardTypes", () => {
    const project = {
      cardTypes: [
        { fields: [{ key: "x", type: "text" }], frontTemplate: "<div/>" },
        { fields: [{ key: "y", type: "text" }], frontTemplate: "<div/>" },
      ],
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
