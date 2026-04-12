import { describe, it, expect } from "vitest";
import { serializeProject, deserializeProject } from "../src/project-format.js";

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

function makeMinimalProject() {
  return {
    name: "Test",
    formatVersion: 5,
    cardTypes: [
      {
        id: "test",
        name: "Test",
        cardSize: { width: "63.5mm", height: "88.9mm" },
        fields: [{ key: "title", type: "text", label: "Title" }],
        frontTemplate: "<div>{{title}}</div>",
        backTemplate: "",
        css: "",
      },
    ],
    defaultCardType: "test",
    data: [{ title: "Card 1" }],
    assets: {},
    fonts: {},
    pdfs: {},
    globalVariables: {},
    exportPresets: [],
  };
}

const TEST_PDF_BASE64 = btoa("FAKE_PDF_CONTENT");
const TEST_PDF_DATA_URI = `data:application/pdf;base64,${TEST_PDF_BASE64}`;

describe("PDF serialization", () => {
  it("round-trips PDF binary content exactly", async () => {
    const project = {
      ...makeMinimalProject(),
      pdfs: {
        "cards.pdf": {
          data: TEST_PDF_DATA_URI,
          type: "application/pdf",
          size: 18,
          pageCount: 3,
        },
      },
    };
    const blob = await serializeProject(project);
    const arrayBuffer = await blobToArrayBuffer(blob);
    const result = await deserializeProject(arrayBuffer);
    expect(result.pdfs).toBeDefined();
    expect(result.pdfs["cards.pdf"]).toBeDefined();
    expect(result.pdfs["cards.pdf"].type).toBe("application/pdf");
    expect(result.pdfs["cards.pdf"].data).toContain(
      "data:application/pdf;base64,",
    );
    expect(result.pdfs["cards.pdf"].data).toContain(TEST_PDF_BASE64);
  });

  it("backward compat: project with no PDFs deserializes without error", async () => {
    const project = makeMinimalProject();
    const blob = await serializeProject(project);
    const arrayBuffer = await blobToArrayBuffer(blob);
    const result = await deserializeProject(arrayBuffer);
    expect(result.pdfs).toBeDefined();
    expect(Object.keys(result.pdfs)).toHaveLength(0);
    expect(result.assets).toBeDefined();
  });

  it("image assets not leaked into pdfs and vice versa", async () => {
    const project = {
      ...makeMinimalProject(),
      assets: {
        "cover.png": {
          data: "data:image/png;base64,iVBORw0KGgo=",
          type: "image/png",
          size: 10,
        },
      },
      pdfs: {
        "cards.pdf": {
          data: TEST_PDF_DATA_URI,
          type: "application/pdf",
          size: 18,
          pageCount: 2,
        },
      },
    };
    const blob = await serializeProject(project);
    const arrayBuffer = await blobToArrayBuffer(blob);
    const result = await deserializeProject(arrayBuffer);
    expect(
      result.assets["cover.png"] || result.assets["image/cover.png"],
    ).toBeDefined();
    expect(result.pdfs["cover.png"]).toBeUndefined();
    expect(result.pdfs["cards.pdf"]).toBeDefined();
    expect(result.assets["cards.pdf"]).toBeUndefined();
  });
});
