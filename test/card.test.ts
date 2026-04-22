import { describe, it, expect, vi } from 'vitest';
import { Project } from '../src/project.ts';
import { CardType } from '../src/card-type.ts';
import { Card } from '../src/card.ts';
import type { ForgeProject, ForgeCardType, ForgeRow } from '../src/types.ts';
import {
  fixtureProject,
  creatureRows,
  spellRows,
} from './fixtures/golden/fixture-project.js';
import { GOLDEN } from './fixtures/golden/snapshots.js';

vi.mock('../src/icon-loader.js', () => ({
  resolveIconUrl: vi.fn((name: string) =>
    name ? `https://example.com/icons/${name}.svg` : null,
  ),
  getCachedIcon: vi.fn(() => null),
}));

vi.mock('../src/qr-code.js', () => ({
  generateQrSvg: vi.fn((val: string) => `<svg data-qr="${val}"></svg>`),
}));

function makeFixtureProject(): Project {
  const state: ForgeProject = {
    name: fixtureProject.name,
    formatVersion: 5,
    cardTypes: fixtureProject.cardTypes as ForgeCardType[],
    data: fixtureProject.data as ForgeRow[],
    globalVariables: fixtureProject.globalVariables,
    assets: fixtureProject.assets as ForgeProject['assets'],
    fonts: fixtureProject.fonts as ForgeProject['fonts'],
    defaultCardType: fixtureProject.defaultCardType,
  };
  return Project.from(state);
}

function makeCreatureCardType(project: Project): CardType {
  return new CardType(project, project.getCardType('creature')!);
}

function makeSpellCardType(project: Project): CardType {
  return new CardType(project, project.getCardType('spell')!);
}

describe('Card construction', () => {
  it('stores the cardType back-reference', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const card = new Card(ct, { name: 'Test', _type: 'creature' }, 0);
    expect(card.cardType).toBe(ct);
  });

  it('stores the index', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const card = new Card(ct, { _type: 'creature' }, 3);
    expect(card.index).toBe(3);
  });
});

describe('Card.getField', () => {
  it('returns field value from the underlying row', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const row: ForgeRow = { name: 'Fire Dragon', attack: '8', _type: 'creature' };
    const card = new Card(ct, row, 0);
    expect(card.getField('name')).toBe('Fire Dragon');
    expect(card.getField('attack')).toBe('8');
  });

  it('returns undefined for missing fields', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, {}, 0).getField('nonexistent')).toBeUndefined();
  });
});

describe('Card.setField live-view mutation', () => {
  it('mutates the underlying row object', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const row: ForgeRow = { name: 'Old Name', _type: 'creature' };
    const card = new Card(ct, row, 0);
    card.setField('name', 'Oak');
    expect(row['name']).toBe('Oak');
    expect(card.getField('name')).toBe('Oak');
  });

  it('mutation is visible in project.data when row is from the project', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const projectRow = project.data.find((r) => r._type === 'creature')!;
    const card = new Card(ct, projectRow, 0);
    const original = card.getField('name');
    card.setField('name', 'Oak');
    expect(project.data.find((r) => r._type === 'creature')?.['name']).toBe('Oak');
    card.setField('name', original);
  });

  it('can set new fields not previously in the row', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const row: ForgeRow = { name: 'Test', _type: 'creature' };
    const card = new Card(ct, row, 0);
    card.setField('custom_field', 42);
    expect(card.getField('custom_field')).toBe(42);
    expect(row['custom_field']).toBe(42);
  });
});

describe('Card.render() structure', () => {
  it('returns html, css, width, height, cardTypeId', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const result = new Card(ct, { _type: 'creature' }, 0).render({ side: 'front' });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('css');
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
    expect(result).toHaveProperty('cardTypeId');
  });

  it('returns correct dimensions for creature card type', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const result = new Card(ct, { _type: 'creature' }, 0).render({ side: 'front' });
    expect(result?.width).toBe('63.5mm');
    expect(result?.height).toBe('88.9mm');
    expect(result?.cardTypeId).toBe('creature');
  });

  it('returns correct dimensions for spell card type', () => {
    const project = makeFixtureProject();
    const ct = makeSpellCardType(project);
    const result = new Card(ct, { _type: 'spell' }, 0).render({ side: 'front' });
    expect(result?.width).toBe('57mm');
    expect(result?.height).toBe('87mm');
    expect(result?.cardTypeId).toBe('spell');
  });

  it('returns null for back side when no backTemplate exists', () => {
    const project = makeFixtureProject();
    const ct = makeSpellCardType(project);
    expect(new Card(ct, { _type: 'spell', name: 'Fireball' }, 0).render({ side: 'back' })).toBeNull();
  });

  it('renders back side when backTemplate exists', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const result = new Card(ct, { name: 'Fire Dragon', type: 'dragon', _type: 'creature' }, 0).render({ side: 'back' });
    expect(result).not.toBeNull();
    expect(result?.html).toContain('card-back');
  });
});

describe('Card.render() CSS', () => {
  it('includes @font-face rules from project.fonts', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const result = new Card(ct, { _type: 'creature' }, 0).render({ side: 'front' });
    expect(result?.css).toContain('@font-face');
    expect(result?.css).toContain('GameFont');
    expect(result?.css).toContain('SpellFont');
  });

  it('scopes CSS with [data-card-type] selector', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, { _type: 'creature' }, 0).render({ side: 'front' })?.css).toContain('[data-card-type="creature"]');
  });

  it('resolves {{{asset:...}}} in CSS to data URIs', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const css = new Card(ct, { _type: 'creature' }, 0).render({ side: 'front' })?.css ?? '';
    expect(css).toContain('data:image/png;base64,');
    expect(css).not.toContain('{{{asset:');
  });

  it('includes --cm-* CSS custom properties from color mappings', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, { type: 'dragon', _type: 'creature' }, 0).render({ side: 'front' })?.css).toContain('--cm-borderColor');
  });
});

describe('Card.render() HTML', () => {
  it('renders field values into templates', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const html = new Card(ct, { name: 'Test Dragon', type: 'dragon', attack: '5', defense: '3', _type: 'creature' }, 0).render({ side: 'front' })?.html ?? '';
    expect(html).toContain('Test Dragon');
  });

  it('injects global variables via {{$varName}} syntax', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, { _type: 'creature' }, 0).render({ side: 'front' })?.html).toContain('Mythic Forge');
  });

  it('evaluates computed fields: power = attack + defense', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, { attack: '5', defense: '3', _type: 'creature' }, 0).render({ side: 'front' })?.html).toContain('PWR: 8');
  });

  it('applies color mapping to resolve field values', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, { type: 'dragon', _type: 'creature' }, 0).render({ side: 'front' })?.html).toContain('#ef4444');
  });

  it('HTML-escapes special characters in field values', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const html = new Card(ct, { name: 'Forest <Guardian>', _type: 'creature' }, 0).render({ side: 'front' })?.html ?? '';
    expect(html).toContain('Forest &lt;Guardian&gt;');
    expect(html).not.toContain('Forest <Guardian>');
  });

  it('renders QR code SVG for qr-type fields', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const html = new Card(ct, { wiki_url: 'https://example.com/test', _type: 'creature' }, 0).render({ side: 'front' })?.html ?? '';
    expect(html).toContain('<svg data-qr="https://example.com/test">');
  });

  it('renders icon images for icon-type fields', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const html = new Card(ct, { icon_name: 'dragon', _type: 'creature' }, 0).render({ side: 'front' })?.html ?? '';
    expect(html).toContain('https://example.com/icons/dragon.svg');
  });
});

describe('Card.render({ templateOverride })', () => {
  it('renders with custom template override on front', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const result = new Card(ct, { name: 'My Card', _type: 'creature' }, 0).render({ templateOverride: '<div class="custom">{{name}}</div>' });
    expect(result).not.toBeNull();
    expect(result?.html).toBe('<div class="custom">My Card</div>');
  });

  it('templateOverride still includes font face CSS', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    expect(new Card(ct, { _type: 'creature' }, 0).render({ templateOverride: '<div>test</div>' })?.css).toContain('@font-face');
  });

  it('templateOverride works for back side', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const result = new Card(ct, { name: 'My Card', _type: 'creature' }, 0).render({ side: 'back', templateOverride: '<div class="back">{{name}}</div>' });
    expect(result).not.toBeNull();
    expect(result?.html).toBe('<div class="back">My Card</div>');
  });

  it('templateOverride enables back rendering even without backTemplate', () => {
    const project = makeFixtureProject();
    const ct = makeSpellCardType(project);
    const result = new Card(ct, { name: 'Fireball', _type: 'spell' }, 0).render({ side: 'back', templateOverride: '<div class="back">{{name}}</div>' });
    expect(result).not.toBeNull();
    expect(result?.html).toBe('<div class="back">Fireball</div>');
  });
});

describe('Card.evaluateComputed()', () => {
  it('evaluates computed fields and stores results in row', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const row: ForgeRow = { attack: '5', defense: '3', _type: 'creature' };
    const card = new Card(ct, row, 0);
    card.evaluateComputed();
    expect(card.getField('power')).toBe(8);
  });
});

describe('Golden output: creature cards (front)', () => {
  creatureRows.forEach((fixtureRow, i) => {
    it(`creature[${i}] "${fixtureRow.name}" front matches golden`, () => {
      const project = makeFixtureProject();
      const ct = makeCreatureCardType(project);
      const card = new Card(ct, project.data[i], i);
      const result = card.render({ side: 'front' });
      expect(result).not.toBeNull();
      const golden = GOLDEN[`creature_front_${i}` as keyof typeof GOLDEN];
      expect(result!.html).toBe(golden.html);
      expect(result!.css).toBe(golden.css);
      expect(result!.width).toBe(golden.width);
      expect(result!.height).toBe(golden.height);
      expect(result!.cardTypeId).toBe(golden.cardTypeId);
    });
  });
});

describe('Golden output: creature cards (back)', () => {
  creatureRows.forEach((fixtureRow, i) => {
    it(`creature[${i}] "${fixtureRow.name}" back matches golden`, () => {
      const project = makeFixtureProject();
      const ct = makeCreatureCardType(project);
      const card = new Card(ct, project.data[i], i);
      const result = card.render({ side: 'back' });
      expect(result).not.toBeNull();
      const golden = GOLDEN[`creature_back_${i}` as keyof typeof GOLDEN];
      expect(result!.html).toBe(golden.html);
      expect(result!.css).toBe(golden.css);
      expect(result!.width).toBe(golden.width);
      expect(result!.height).toBe(golden.height);
      expect(result!.cardTypeId).toBe(golden.cardTypeId);
    });
  });
});

describe('Golden output: spell cards (front)', () => {
  spellRows.forEach((fixtureRow, i) => {
    it(`spell[${i}] "${fixtureRow.name}" front matches golden`, () => {
      const project = makeFixtureProject();
      const ct = makeSpellCardType(project);
      const card = new Card(ct, project.data[5 + i], i); // 5 creature rows precede spell rows
      const result = card.render({ side: 'front' });
      expect(result).not.toBeNull();
      const golden = GOLDEN[`spell_front_${i}` as keyof typeof GOLDEN];
      expect(result!.html).toBe(golden.html);
      expect(result!.css).toBe(golden.css);
      expect(result!.width).toBe(golden.width);
      expect(result!.height).toBe(golden.height);
      expect(result!.cardTypeId).toBe(golden.cardTypeId);
    });
  });
});

describe('Golden output: spell cards (back) — no backTemplate', () => {
  spellRows.forEach((fixtureRow, i) => {
    it(`spell[${i}] "${fixtureRow.name}" back returns null`, () => {
      const project = makeFixtureProject();
      const ct = makeSpellCardType(project);
      expect(new Card(ct, project.data[5 + i], i).render({ side: 'back' })).toBeNull();
    });
  });
});

describe('Golden output: edge case', () => {
  it('creature_back_empty_row golden matches first creature card back', () => {
    const project = makeFixtureProject();
    const ct = makeCreatureCardType(project);
    const card = new Card(ct, project.data[0], 0);
    const result = card.render({ side: 'back' });
    expect(result).not.toBeNull();
    const golden = GOLDEN.creature_back_empty_row;
    expect(result!.html).toBe(golden.html);
    expect(result!.css).toBe(golden.css);
  });
});
