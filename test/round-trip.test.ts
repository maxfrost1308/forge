import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import type { ForgeCardType, ForgeProject } from '../src/types';
import {
  fixtureProject,
  creatureCardType,
  spellCardType,
  creatureRows,
  spellRows,
  assets as fixtureAssets,
  fonts as fixtureFonts,
  globalVariables as fixtureGlobalVars,
} from './fixtures/golden/fixture-project';

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function roundTrip(project: Project): Promise<Project> {
  const buf = await project.save();
  return Project.load(buf);
}

function ensureBase64Padding(dataUri: string): string {
  const m = dataUri.match(/^(data:[^;]+;base64,)(.+)$/);
  if (!m) return dataUri;
  let b64 = m[2];
  while (b64.length % 4 !== 0) b64 += '=';
  return m[1] + b64;
}

function makeTestFixture(): ForgeProject {
  const validFonts: Record<string, { data: string; type: string; family: string }> = {};
  for (const [k, v] of Object.entries(fixtureFonts)) {
    validFonts[k] = { ...v, data: ensureBase64Padding(v.data) };
  }
  return { ...fixtureProject, formatVersion: 5, fonts: validFonts } as ForgeProject;
}

function minimalCardType(overrides: Partial<ForgeCardType> = {}): ForgeCardType {
  return {
    id: 'basic',
    name: 'Basic',
    cardSize: { width: '63.5mm', height: '88.9mm' },
    fields: [
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'value', type: 'number', label: 'Value' },
    ],
    frontTemplate: '<div>{{title}}: {{value}}</div>',
    backTemplate: null,
    css: '.card { padding: 10px; }',
    ...overrides,
  };
}

/** Deep-compare card type schema, templates, and CSS */
function expectCardTypeMatch(a: ForgeCardType, b: ForgeCardType) {
  expect(a.id).toBe(b.id);
  expect(a.name).toBe(b.name);
  expect(a.cardSize).toEqual(b.cardSize);
  expect(a.fields).toEqual(b.fields);
  expect(a.frontTemplate).toBe(b.frontTemplate);
  expect(a.css).toBe(b.css);
  expect(a.backTemplate ?? null).toEqual(b.backTemplate ?? null);
  expect(a.colorMapping ?? null).toEqual(b.colorMapping ?? null);
  expect(a.aggregations ?? null).toEqual(b.aggregations ?? null);
}

/* ── idempotency: save → load → save → load produces identical state ───── */

describe('round-trip serialization', () => {
  describe('idempotency', () => {
    it('single-type project', async () => {
      const p0 = Project.fromScratch({ name: 'Single Type' });
      p0.addCardType(minimalCardType());
      p0.data.push(
        { _type: 'basic', title: 'Alpha', value: '10' },
        { _type: 'basic', title: 'Beta', value: '20' },
        { _type: 'basic', title: 'Has "quotes", commas', value: '30' },
      );

      const p1 = await roundTrip(p0);
      const p2 = await roundTrip(p1);

      expect(p2.name).toBe(p1.name);
      expect(p2.cardTypes.length).toBe(1);
      expectCardTypeMatch(p1.cardTypes[0], p2.cardTypes[0]);
      expect(p2.data).toEqual(p1.data);
      expect(p2.globalVariables).toEqual(p1.globalVariables);
    });

    it('multi-type fixture project', async () => {
      const p0 = Project.from(makeTestFixture());

      const p1 = await roundTrip(p0);
      const p2 = await roundTrip(p1);

      expect(p2.name).toBe(p1.name);
      expect(p2.cardTypes.length).toBe(p1.cardTypes.length);

      const byId = (cts: ForgeCardType[]) => [...cts].sort((a, b) => a.id.localeCompare(b.id));
      const sorted1 = byId(p1.cardTypes);
      const sorted2 = byId(p2.cardTypes);
      for (let i = 0; i < sorted1.length; i++) {
        expectCardTypeMatch(sorted1[i], sorted2[i]);
      }

      expect(p2.data).toEqual(p1.data);
      expect(p2.assets).toEqual(p1.assets);
      expect(p2.fonts).toEqual(p1.fonts);
      expect(p2.globalVariables).toEqual(p1.globalVariables);
    });

    it('project with assets and fonts', async () => {
      const p0 = Project.fromScratch({ name: 'Assets & Fonts' });
      p0.addCardType(minimalCardType());
      p0.data.push({ _type: 'basic', title: 'Test', value: '1' });
      p0.addAsset('image/logo.png', {
        data: 'data:image/png;base64,iVBORw0KGgo=',
        type: 'image/png',
      });
      p0.addFont('CustomFont.woff2', {
        data: 'data:font/woff2;base64,d09GMgABAAAAAADcAAoAAAAA',
        type: 'font/woff2',
        family: 'CustomFont',
      });

      const p1 = await roundTrip(p0);
      const p2 = await roundTrip(p1);

      expect(Object.keys(p1.assets).length).toBeGreaterThan(0);
      expect(Object.keys(p1.fonts)).toEqual(['CustomFont.woff2']);
      expect(p2.assets).toEqual(p1.assets);
      expect(p2.fonts).toEqual(p1.fonts);
    });

    it('project with global variables', async () => {
      const p0 = Project.fromScratch({ name: 'Variables' });
      p0.addCardType(minimalCardType());
      p0.data.push({ _type: 'basic', title: 'X', value: '0' });
      p0.setVariable('game_name', 'My Game');
      p0.setVariable('version', '2.0');
      p0.setVariable('author_name', 'Tester');

      const p1 = await roundTrip(p0);
      const p2 = await roundTrip(p1);

      expect(p1.globalVariables).toEqual({
        game_name: 'My Game',
        version: '2.0',
        author_name: 'Tester',
      });
      expect(p2.globalVariables).toEqual(p1.globalVariables);
    });

    it('empty project (card type, no data)', async () => {
      const p0 = Project.fromScratch({ name: 'Empty' });
      p0.addCardType(minimalCardType());

      const p1 = await roundTrip(p0);
      const p2 = await roundTrip(p1);

      expect(p1.name).toBe('Empty');
      expect(p1.data).toEqual([]);
      expect(p2.name).toBe(p1.name);
      expectCardTypeMatch(p1.cardTypes[0], p2.cardTypes[0]);
      expect(p2.data).toEqual([]);
    });
  });

  /* ── data preservation after single round-trip ──────────────────────── */

  describe('data preservation', () => {
    it('card type structure (id, name, fields, templates, css, cardSize)', async () => {
      const p0 = Project.from(makeTestFixture());
      const p1 = await roundTrip(p0);

      expect(p1.cardTypes.length).toBe(2);

      const creature = p1.getCardType('creature')!;
      expect(creature).not.toBeNull();
      expect(creature.name).toBe('Creature');
      expect(creature.cardSize).toEqual({ width: '63.5mm', height: '88.9mm' });
      expect(creature.fields).toEqual(creatureCardType.fields);
      expect(creature.frontTemplate).toBe(creatureCardType.frontTemplate);
      expect(creature.css).toBe(creatureCardType.css);
      expect(creature.backTemplate).toBe(creatureCardType.backTemplate);
      expect(creature.colorMapping).toEqual(creatureCardType.colorMapping);

      const spell = p1.getCardType('spell')!;
      expect(spell).not.toBeNull();
      expect(spell.name).toBe('Spell');
      expect(spell.cardSize).toEqual({ width: '57mm', height: '87mm' });
      expect(spell.fields).toEqual(spellCardType.fields);
      expect(spell.backTemplate).toBeNull();
      expect(spell.colorMapping).toEqual(spellCardType.colorMapping);
    });

    it('row values, _type assignment, and special characters', async () => {
      const p0 = Project.from(makeTestFixture());
      const p1 = await roundTrip(p0);

      expect(p1.data.length).toBe(creatureRows.length + spellRows.length);

      const creatures = p1.data.filter((r) => r._type === 'creature');
      expect(creatures.length).toBe(creatureRows.length);

      const dragon = creatures.find((r) => r['name'] === 'Fire Dragon')!;
      expect(dragon).toBeDefined();
      expect(dragon['attack']).toBe('8');
      expect(dragon['defense']).toBe('6');
      expect(dragon['tags']).toBe('fire|flying|rare');
      expect(dragon['wiki_url']).toBe('https://example.com/fire-dragon');

      const guardian = creatures.find((r) => r['name'] === 'Forest <Guardian>')!;
      expect(guardian).toBeDefined();
      expect(guardian['flavor']).toBe('Protects the "Ancient Grove" from intruders.');

      const spells = p1.data.filter((r) => r._type === 'spell');
      expect(spells.length).toBe(spellRows.length);
      const fireball = spells.find((r) => r['name'] === 'Fireball')!;
      expect(fireball['cost']).toBe('3');
      expect(fireball['damage']).toBe('5');
      expect(fireball['keywords']).toBe('instant;burn;area');
    });

    it('special columns (_qty, _notes) preserved', async () => {
      const p0 = Project.fromScratch({ name: 'Special Cols' });
      p0.addCardType(minimalCardType());
      p0.data.push(
        { _type: 'basic', title: 'A', value: '1', _qty: '3', _notes: 'keep this' },
        { _type: 'basic', title: 'B', value: '2', _qty: '1', _notes: '' },
      );

      const p1 = await roundTrip(p0);

      expect(p1.data.length).toBe(2);
      const rowA = p1.data.find((r) => r['title'] === 'A')!;
      expect(rowA).toBeDefined();
      expect(rowA['_qty']).toBe('3');
      expect(rowA['_notes']).toBe('keep this');
      expect(rowA._type).toBe('basic');

      const rowB = p1.data.find((r) => r['title'] === 'B')!;
      expect(rowB['_qty']).toBe('1');
    });

    it('assets preserved with normalized keys', async () => {
      const p0 = Project.from(makeTestFixture());
      const p1 = await roundTrip(p0);

      for (const [key, asset] of Object.entries(fixtureAssets)) {
        const normalizedKey = key.includes('/') ? key : `image/${key}`;
        const loaded = p1.assets[normalizedKey] ?? p1.assets[key];
        expect(loaded, `asset "${key}" missing after round-trip`).toBeDefined();
        expect(loaded.data).toBe(asset.data);
        expect(loaded.type).toBe(asset.type);
      }
    });

    it('fonts preserved exactly', async () => {
      const p0 = Project.from(makeTestFixture());
      const p1 = await roundTrip(p0);

      const fixture = makeTestFixture();
      expect(Object.keys(p1.fonts).length).toBe(Object.keys(fixture.fonts).length);
      for (const [name, font] of Object.entries(fixture.fonts)) {
        expect(p1.fonts[name], `font "${name}" missing`).toBeDefined();
        expect(p1.fonts[name].data).toBe(font.data);
        expect(p1.fonts[name].type).toBe(font.type);
        expect(p1.fonts[name].family).toBe(font.family);
      }
    });

    it('global variables preserved exactly', async () => {
      const p0 = Project.from(makeTestFixture());
      const p1 = await roundTrip(p0);

      expect(p1.globalVariables).toEqual(fixtureGlobalVars);
    });
  });

  /* ── format version ─────────────────────────────────────────────────── */

  describe('format version', () => {
    it('FORMAT_VERSION is 5', () => {
      expect(Project.FORMAT_VERSION).toBe(5);
    });

    it('validate() returns valid after round-trip', async () => {
      const p0 = Project.from(makeTestFixture());
      const p1 = await roundTrip(p0);

      const result = p1.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('double round-trip produces valid project', async () => {
      const p0 = Project.fromScratch({ name: 'Version Check' });
      p0.addCardType(minimalCardType());
      p0.data.push({ _type: 'basic', title: 'Test', value: '1' });

      const p1 = await roundTrip(p0);
      const p2 = await roundTrip(p1);

      expect(p1.validate().valid).toBe(true);
      expect(p2.validate().valid).toBe(true);
    });
  });
});
