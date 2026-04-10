// forge-renderer — public API
// Browser-only library for rendering Card Maker .forge projects
// without the full editor UI.

export {
  renderCard,
  renderTemplate,
  compileTemplate,
  preprocessRow,
} from "./template-renderer.js";

export { generateQrSvg } from "./qr-code.js";

export { validateVariableName, injectVariables } from "./global-variables.js";

export { resolveIconUrl, fetchIcon, getCachedIcon } from "./icon-loader.js";

export { parseCsv, generateCsv } from "./csv-parser.js";

export {
  validateCardType,
  scopeCss,
  sanitizeTemplate,
} from "./card-type-registry-core.js";

export { deserializeProject, serializeProject } from "./project-format.js";

export { hashTagColor } from "./color-utils.js";
