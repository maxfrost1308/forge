/**
 * Golden fixture project — a rich in-memory ForgeProject used to capture
 * deterministic rendering output from the current (pre-OO) API.
 *
 * Covers: 2 card types (creature + spell), front/back templates, various
 * field types, global variables, color mappings, assets, fonts, computed
 * fields, conditionals, QR codes, icons, and edge cases.
 */

// ── Tiny base64 PNG: 1x1 red pixel ──────────────────────────────────────────
const RED_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

// ── Tiny base64 PNG: 1x1 blue pixel ─────────────────────────────────────────
const BLUE_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

// ── Mock font data (minimal, just needs to be a valid base64 data URI) ───────
const MOCK_FONT_WOFF2 = "data:font/woff2;base64,d09GMgABAAAAAADcAAoAAAAA";
const MOCK_FONT_TTF = "data:font/ttf;base64,AAEAAAALAIAAAwAwT1MvMg";

// ── Card type: "creature" ────────────────────────────────────────────────────
export const creatureCardType = {
  id: "creature",
  name: "Creature",
  cardSize: { width: "63.5mm", height: "88.9mm" },
  fields: [
    { key: "name", type: "text", label: "Name" },
    { key: "type", type: "select", label: "Type", options: ["beast", "dragon", "undead", "elemental"] },
    { key: "tags", type: "tags", separator: "|", label: "Tags" },
    { key: "attack", type: "number", label: "Attack" },
    { key: "defense", type: "number", label: "Defense" },
    { key: "power", type: "computed", label: "Power", expression: "attack + defense" },
    { key: "element", type: "multi-select", separator: ",", label: "Element" },
    { key: "icon_name", type: "icon", label: "Icon" },
    { key: "card_art", type: "image", label: "Card Art" },
    { key: "card_bg", type: "background", label: "Background" },
    { key: "flavor", type: "text-long", label: "Flavor Text" },
    { key: "wiki_url", type: "qr", label: "Wiki URL" },
  ],
  colorMapping: {
    borderColor: {
      field: "type",
      map: { beast: "#4ade80", dragon: "#ef4444", undead: "#a855f7" },
      auto: true,
      default: "#888888",
    },
    bgTint: {
      field: "element",
      map: { "fire": "#ff6b35", "water": "#0077b6", "earth": "#606c38" },
      auto: false,
      default: "#f5f5f5",
    },
  },
  frontTemplate: `<div class="card creature-card" style="border-color: {{borderColor}}; background: {{bgTint}}">
  <div class="card-header">
    <h1 class="card-name">{{name}}</h1>
    <span class="card-type">{{upper type}}</span>
    <span class="game-badge">{{$game_name}} v{{$version}}</span>
  </div>
  <div class="card-art">{{{card_art}}}</div>
  {{#tags}}<div class="tags">{{#tags}}<span class="tag">{{.}}</span>{{/tags}}</div>{{/tags}}
  <div class="stats">
    <span class="attack">ATK: {{attack}}</span>
    <span class="defense">DEF: {{defense}}</span>
    <span class="power">PWR: {{power}}</span>
  </div>
  {{#flavor}}<div class="flavor-text"><em>{{flavor}}</em></div>{{/flavor}}
  {{#icon_name}}<div class="icon">{{{icon:icon_name}}}</div>{{/icon_name}}
  {{#eq type "dragon"}}<div class="dragon-badge">DRAGON</div>{{/eq}}
  {{#gt attack 5}}<div class="elite-badge">ELITE</div>{{/gt}}
  {{^flavor}}<div class="no-flavor">No flavor text</div>{{/flavor}}
  {{#wiki_url}}<div class="qr">{{{qr:wiki_url}}}</div>{{/wiki_url}}
  <div class="elements">{{element}}</div>
</div>`,
  backTemplate: `<div class="card-back creature-back">
  <div class="back-logo">{{$game_name}}</div>
  <div class="card-id">{{name}} - {{type}}</div>
</div>`,
  css: `.card { padding: 10px; border: 3px solid; border-radius: 8px; }
.card-header { display: flex; justify-content: space-between; }
.card-name { font-family: "GameFont", sans-serif; margin: 0; }
.card-art img { max-width: 100%; }
.stats { display: flex; gap: 10px; }
.dragon-badge { color: red; font-weight: bold; }
.elite-badge { color: gold; }
.card-back { background: url({{{asset:card-back.png}}}); text-align: center; }
.flavor-text { font-style: italic; }`,
};

// ── Card type: "spell" ───────────────────────────────────────────────────────
export const spellCardType = {
  id: "spell",
  name: "Spell",
  cardSize: { width: "57mm", height: "87mm" },
  fields: [
    { key: "name", type: "text", label: "Name" },
    { key: "school", type: "select", label: "School", options: ["fire", "ice", "arcane", "nature"] },
    { key: "cost", type: "number", label: "Mana Cost" },
    { key: "damage", type: "number", label: "Damage" },
    { key: "total_value", type: "computed", label: "Total Value", expression: "(cost + damage) * 2" },
    { key: "effect", type: "text-long", label: "Effect" },
    { key: "spell_art", type: "image", label: "Spell Art" },
    { key: "keywords", type: "multi-select", separator: ";", label: "Keywords" },
  ],
  colorMapping: {
    schoolColor: {
      field: "school",
      map: { fire: "#dc2626", ice: "#2563eb", arcane: "#7c3aed" },
      auto: true,
      default: "#666666",
    },
  },
  frontTemplate: `<div class="spell-card" style="border-color: {{schoolColor}}">
  <div class="spell-header">
    <h2>{{name}}</h2>
    <span class="mana-cost">{{cost}}</span>
  </div>
  <div class="spell-school">{{capitalize school}}</div>
  {{#spell_art}}<div class="spell-art">{{{spell_art}}}</div>{{/spell_art}}
  <div class="spell-effect">{{effect}}</div>
  {{#damage}}<div class="spell-damage">Damage: {{damage}} (Value: {{total_value}})</div>{{/damage}}
  {{#keywords}}<div class="keywords">{{#keywords}}<span class="keyword">{{.}}</span>{{/keywords}}</div>{{/keywords}}
  {{^effect}}<div class="no-effect">No effect text</div>{{/effect}}
  {{#eq school "fire"}}<div class="fire-warning">Burns on contact!</div>{{/eq}}
  <div class="game-info">{{$game_name}}</div>
</div>`,
  // spell has NO back template — tests null backTemplate behavior
  backTemplate: null,
  css: `.spell-card { padding: 8px; border: 2px solid; border-radius: 6px; font-family: "SpellFont", serif; }
.spell-header { display: flex; justify-content: space-between; align-items: center; }
.spell-header h2 { margin: 0; }
.mana-cost { font-size: 1.5em; font-weight: bold; }
.spell-damage { color: red; }
.fire-warning { color: orange; font-weight: bold; }`,
};

// ── Data rows: creatures ─────────────────────────────────────────────────────
export const creatureRows = [
  {
    _type: "creature",
    name: "Fire Dragon",
    type: "dragon",
    tags: "fire|flying|rare",
    attack: "8",
    defense: "6",
    element: "fire,air",
    icon_name: "dragon",
    card_art: "asset:dragon-art.png",
    card_bg: "asset:card-back.png",
    flavor: "Born from the heart of a volcano.",
    wiki_url: "https://example.com/fire-dragon",
  },
  {
    _type: "creature",
    name: "Shadow Wolf",
    type: "beast",
    tags: "shadow|pack",
    attack: "4",
    defense: "3",
    element: "earth",
    icon_name: "wolf",
    card_art: "asset:wolf-art.png",
    card_bg: "",
    flavor: "",
    wiki_url: "",
  },
  {
    _type: "creature",
    name: "Bone Revenant",
    type: "undead",
    tags: "undead|spirit|ancient",
    attack: "5",
    defense: "7",
    element: "",
    icon_name: "",
    card_art: "",
    card_bg: "",
    flavor: "It whispers secrets of the dead.",
    wiki_url: "https://example.com/bone-revenant",
  },
  {
    _type: "creature",
    name: "Storm Elemental",
    type: "elemental",
    tags: "",
    attack: "6",
    defense: "4",
    element: "air,water",
    icon_name: "lightning",
    card_art: "",
    card_bg: "",
    flavor: "",
    wiki_url: "",
  },
  {
    _type: "creature",
    name: "Forest <Guardian>",
    type: "beast",
    tags: "nature|guardian",
    attack: "3",
    defense: "9",
    element: "earth,water",
    icon_name: "",
    card_art: "asset:guardian-art.png",
    card_bg: "asset:card-back.png",
    flavor: 'Protects the "Ancient Grove" from intruders.',
    wiki_url: "",
  },
];

// ── Data rows: spells ────────────────────────────────────────────────────────
export const spellRows = [
  {
    _type: "spell",
    name: "Fireball",
    school: "fire",
    cost: "3",
    damage: "5",
    effect: "Deal 5 damage to target creature.",
    spell_art: "asset:fireball-art.png",
    keywords: "instant;burn;area",
  },
  {
    _type: "spell",
    name: "Ice Shield",
    school: "ice",
    cost: "2",
    damage: "0",
    effect: "Gain 4 armor until end of turn.",
    spell_art: "",
    keywords: "defense;reaction",
  },
  {
    _type: "spell",
    name: "Arcane Surge",
    school: "arcane",
    cost: "5",
    damage: "3",
    effect: "",
    spell_art: "asset:arcane-art.png",
    keywords: "",
  },
  {
    _type: "spell",
    name: "Nature's Embrace",
    school: "nature",
    cost: "1",
    damage: "0",
    effect: "Heal 3 health to target creature.",
    spell_art: "",
    keywords: "heal",
  },
  {
    _type: "spell",
    name: "Void Bolt",
    school: "arcane",
    cost: "4",
    damage: "7",
    effect: "Deal 7 damage. If target dies, draw a card.",
    spell_art: "",
    keywords: "instant;destruction;draw",
  },
];

// ── Assets ───────────────────────────────────────────────────────────────────
export const assets: Record<string, { data: string; type: string; size: number }> = {
  "dragon-art.png": { data: RED_PIXEL, type: "image/png", size: 95 },
  "wolf-art.png": { data: BLUE_PIXEL, type: "image/png", size: 95 },
  "guardian-art.png": { data: RED_PIXEL, type: "image/png", size: 95 },
  "fireball-art.png": { data: RED_PIXEL, type: "image/png", size: 95 },
  "arcane-art.png": { data: BLUE_PIXEL, type: "image/png", size: 95 },
  "card-back.png": { data: BLUE_PIXEL, type: "image/png", size: 95 },
};

// ── Fonts ────────────────────────────────────────────────────────────────────
export const fonts: Record<string, { data: string; type: string; family: string }> = {
  "GameFont.woff2": { data: MOCK_FONT_WOFF2, type: "font/woff2", family: "GameFont" },
  "SpellFont.ttf": { data: MOCK_FONT_TTF, type: "font/ttf", family: "SpellFont" },
};

// ── Global variables ─────────────────────────────────────────────────────────
export const globalVariables: Record<string, string> = {
  game_name: "Mythic Forge",
  version: "2.1",
};

// ── Full assembled project ───────────────────────────────────────────────────
export const fixtureProject = {
  name: "Golden Fixture Project",
  cardTypes: [creatureCardType, spellCardType],
  data: [...creatureRows, ...spellRows],
  globalVariables,
  assets,
  fonts,
  defaultCardType: "creature",
};
