// forge-renderer — public API

export {
  renderCard,
  renderFullCard,
  buildFontFaceCss,
  renderTemplate,
  compileTemplate,
  preprocessRow,
  escapeHtml,
  getAutoColorVars,
  resolveAssetReference,
  preprocessCssAssets,
  evaluateExpression,
  validateComputedFields,
  detectFontFormat,
  escapeCssFontName,
} from "./template-renderer.js";

export { generateQrSvg } from "./qr-code.js";

export {
  validateVariableName,
  injectVariables,
  findVariableReferences,
} from "./global-variables.js";

export {
  resolveIconUrl,
  fetchIcon,
  getCachedIcon,
  preloadIcons,
  clearCache,
} from "./icon-loader.js";

export { parseCsv, generateCsv, remapHeaders } from "./csv-parser.js";

export {
  validateCardType,
  scopeCss,
  sanitizeTemplate,
  processCss,
  buildCardTypeFromUpload,
  buildCardTypeFromBundle,
} from "./card-type-registry-core.js";

export {
  deserializeProject,
  serializeProject,
  serializeTemplateOnly,
  validateProject,
  CURRENT_FORMAT_VERSION,
} from "./project-format.js";

export { hashTagColor } from "./color-utils.js";

export {
  getCardTypes,
  getCardsByType,
  getCard,
  sortCards,
  getProjectSummary,
} from "./project-query.js";
