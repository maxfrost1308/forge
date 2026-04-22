
## T12: Golden Output Snapshots

- Fixture project has 2 card types (creature: 12 fields, spell: 8 fields), 5 rows each
- Creature has front+back templates; spell has null backTemplate (edge case covered)
- `capture-snapshots.test.ts` generates `snapshots.ts` via vitest (needs vi.mock for icon-loader, qr-code)
- Golden entries exported as `GOLDEN: Record<string, GoldenEntry>` for T13 import
- 16 golden entries total: 5 creature fronts, 5 creature backs, 5 spell fronts, 1 creature_back_empty_row
- Spell back renders null (5 tests verify this separately, not in snapshots)
- Edge cases captured: HTML escaping (`<Guardian>`, `"Ancient Grove"`, `'s`), empty fields, empty tags, auto-color, explicit color map, computed fields (`attack+defense`, `(cost+damage)*2`), conditional blocks (#eq, #gt, ^inverted), QR code, icon references, global variables
- The `bgTint` color mapping uses `auto: false` — so unmapped multi-select values like "fire,air" get split to ["fire","air"], and since `element` is multi-select, getAutoColorVars uses `String(sourceVal[0])` which is "fire" — this maps to #ff6b35 for creature_front_0 but the colorMapping default #f5f5f5 gets written as --cm-bgTint in CSS custom properties 
- Important: getAutoColorVars operates on the RAW row (not preprocessed), so multi-select fields are still strings at that point — "fire,air" gets looked up as-is in the map, doesn't match "fire", falls to default
- Wait — looking again at the code: getAutoColorVars takes `row` not preprocessed data, and for creature_front_0 the bgTint CSS var is #f5f5f5 (default), not #ff6b35. This is because "fire,air" doesn't match "fire" in the map. But the inline style uses preprocessRow output where bgTint IS set via colorMapping in preprocessRow — which DOES split arrays. So the inline {{bgTint}} shows #ff6b35 from preprocessRow, while --cm-bgTint in CSS shows #f5f5f5 from getAutoColorVars. Subtle difference!

## T8: Project Class Implementation

- `papaparse` has no bundled TS types — install `@types/papaparse` as devDep (v5.5.2 available)
- `jszip@3` uses `export = JSZip` style — works with `import JSZip from 'jszip'` under `moduleResolution: bundler` (implicit `allowSyntheticDefaultImports`)
- `Project.from(state)` stores reference directly — mutations via Project API propagate to original object
- `removeCardType` uses `splice` (in-place) not `filter` (creates new array) to maintain live-view semantics
- `ForgeProject` interface lacks `pdfs`, `exportPresets`, `editorData` — use local `ExtendedProject` intersection type
- `generateAsync({ type: 'arraybuffer' })` avoids Blob→ArrayBuffer conversion (JSZip supports arraybuffer natively)
- 50 tests: FORMAT_VERSION, fromScratch, from (live-view), name, data, cardTypes, getCardType, addCardType, removeCardType, globalVariables, setVariable, removeVariable, assets, fonts, importCsv, validate, save/load round-trip, saveTemplateOnly

## T10: ReadonlyProject Wrapper

- ReadonlyProject wraps Project instance, proxies read getters/methods, throws on all mutations
- `import type` with `.ts` extension works (erased at compile), but value `import` with `.ts` needs `allowImportingTsExtensions` — use extensionless import for value imports
- Circular dependency (Project ↔ ReadonlyProject) works fine since ReadonlyProject only uses `import type { Project }` and Project uses value import of ReadonlyProject
- 26 tests: FORMAT_VERSION, 12 read access, 10 mutation throws, 2 rendering access, 2 Project.readonly()
- Name setter uses `set name(_value: string)` that throws — this blocks `readonly.name = "x"` at runtime

## T9: CardType Class Implementation

- CardType stores a REFERENCE to `ForgeCardType` from project state; setters mutate project state directly
- Cache is `Card[] | null`; `null` = dirty. Invalidated on `addCard()`/`removeCard()`, rebuilt on next `getCards()`
- `getCards()` mirrors project-query.js logic: if no row has `_type` field, return all rows (single-type project); otherwise filter by `r._type === cardTypeId`
- `Card` placeholder has `row`, `getField()`, `setField()` — minimal interface for T10 to flesh out
- `validate()` ports `validateCardType` from card-type-registry-core.js (id, name, fields)
- `validateComputedFields()` ports template-renderer.js: checks computed fields don't reference other computed fields
- Static `fromUpload`/`fromBundle` return `ForgeCardType` data objects (not CardType instances) — same as the JS originals
- `getScopedCss()` applies sanitizeCss (when `_sanitizeCss` flag set) then scopeCss with `[data-card-type="id"]` prefix
- TypeScript: need `as unknown as Record<string, unknown>` to mutate `ForgeField.type` through type aliases
- `tsc --noEmit` is the substitute for LSP diagnostics when typescript-language-server not installed
- 59 tests: construction, template/css setters (mutation propagates to state), validate, validateComputedFields, getCards (caching + multi/single-type), getCard, Card wrapper, addCard, removeCard, exportCsv, getScopedCss, fromUpload, fromBundle
