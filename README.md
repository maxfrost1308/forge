# forge

Browser library for rendering [Card Maker](https://github.com/maxfrost1308/card-maker) `.forge` projects without the full editor UI.

## Installation

```bash
npm install forge papaparse jszip
```

PapaParse and JSZip are **peer dependencies** — install them alongside forge.

## Usage

```js
import { renderCard, parseCsv, deserializeProject } from "forge";

// Load a .forge project
const project = await deserializeProject(forgeFileArrayBuffer);

// Parse CSV data
const { data, fields } = parseCsv(csvText);

// Render a single card
const html = renderCard(data[0], project.cardType);
```

## API

### Template Rendering

- `compileTemplate(template)` — Pre-compile a Mustache-like template
- `renderTemplate(template, data)` — Render a template with data
- `renderCard(row, cardType)` — Render a complete card from row data
- `preprocessRow(row, cardType)` — Preprocess a data row before rendering

### QR Codes

- `generateQrSvg(text)` — Generate an inline SVG QR code

### Global Variables

- `validateVariableName(name)` — Check if a variable name is valid
- `injectVariables(template, vars)` — Substitute `{{$var}}` placeholders

### Icons

- `resolveIconUrl(name)` — Get the URL for a game-icons.net icon
- `fetchIcon(name)` — Fetch and cache an icon SVG
- `getCachedIcon(name)` — Retrieve a previously cached icon

### CSV

- `parseCsv(csvText)` — Parse CSV text into rows and field names
- `generateCsv(rows, fields)` — Generate CSV text from data

### Card Types

- `validateCardType(cardType)` — Validate a card type schema
- `scopeCss(css, cardTypeId)` — Scope CSS rules to a card type
- `sanitizeTemplate(template)` — Sanitize template HTML

### Project Format

- `deserializeProject(zipData)` — Read a `.forge` ZIP archive
- `serializeProject(project)` — Write a `.forge` ZIP archive

### Utilities

- `hashTagColor(tag)` — Deterministic color from a tag string

## Format Specification

See the [Forge Format Specification](https://github.com/maxfrost1308/card-maker/blob/beta/docs/forge-spec.md) for the complete `.forge` file format reference.

## License

See the [Card Maker repository](https://github.com/maxfrost1308/card-maker) for license details.
