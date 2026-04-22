import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../src/project.ts';
import { CardType, Card } from '../src/card-type.ts';
import type { ForgeProject, ForgeCardType, ForgeRow } from '../src/types.ts';

function makeCardTypeData(overrides: Partial<ForgeCardType> = {}): ForgeCardType {
  return {
    id: 'hero',
    name: 'Hero',
    cardSize: { width: '63.5mm', height: '88.9mm' },
    fields: [
      { key: 'name', type: 'text', label: 'Name' },
      { key: 'power', type: 'number', label: 'Power' },
    ],
    frontTemplate: '<div>{{name}}</div>',
    backTemplate: null,
    css: '',
    colorMapping: null,
    aggregations: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<ForgeProject> = {}): ForgeProject {
  return {
    name: 'Test Project',
    formatVersion: 5,
    cardTypes: [makeCardTypeData()],
    defaultCardType: 'hero',
    data: [
      { name: 'Arthur', power: '5', _type: 'hero' },
      { name: 'Merlin', power: '8', _type: 'hero' },
    ],
    globalVariables: {},
    assets: {},
    fonts: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    cardSizePreset: null,
    ...overrides,
  };
}

function makeProject(overrides: Partial<ForgeProject> = {}): Project {
  return Project.from(makeState(overrides));
}

function makeCardType(overrides: Partial<ForgeProject> = {}): CardType {
  const project = makeProject(overrides);
  const ct = project.cardTypes[0];
  return new CardType(project, ct);
}

describe('CardType construction', () => {
  it('stores the project back-reference', () => {
    const project = makeProject();
    const ct = new CardType(project, project.cardTypes[0]);
    expect(ct.project).toBe(project);
  });

  it('exposes id', () => {
    const ct = makeCardType();
    expect(ct.id).toBe('hero');
  });

  it('exposes name', () => {
    const ct = makeCardType();
    expect(ct.name).toBe('Hero');
  });

  it('exposes fields array', () => {
    const ct = makeCardType();
    expect(ct.fields).toHaveLength(2);
    expect(ct.fields[0].key).toBe('name');
  });

  it('exposes cardSize', () => {
    const ct = makeCardType();
    expect(ct.cardSize).toEqual({ width: '63.5mm', height: '88.9mm' });
  });
});

describe('CardType template and CSS properties', () => {
  it('reads frontTemplate', () => {
    const ct = makeCardType();
    expect(ct.frontTemplate).toBe('<div>{{name}}</div>');
  });

  it('sets frontTemplate and mutates the project state', () => {
    const state = makeState();
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    ct.frontTemplate = '<p>{{name}}</p>';
    expect(ct.frontTemplate).toBe('<p>{{name}}</p>');
    expect(state.cardTypes[0].frontTemplate).toBe('<p>{{name}}</p>');
  });

  it('reads backTemplate (null)', () => {
    const ct = makeCardType();
    expect(ct.backTemplate).toBeNull();
  });

  it('sets backTemplate', () => {
    const state = makeState();
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    ct.backTemplate = '<back>{{name}}</back>';
    expect(ct.backTemplate).toBe('<back>{{name}}</back>');
    expect(state.cardTypes[0].backTemplate).toBe('<back>{{name}}</back>');
  });

  it('reads css', () => {
    const ct = makeCardType();
    expect(ct.css).toBe('');
  });

  it('sets css and mutates state', () => {
    const state = makeState();
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    ct.css = '.card { color: red; }';
    expect(ct.css).toBe('.card { color: red; }');
    expect(state.cardTypes[0].css).toBe('.card { color: red; }');
  });
});

describe('CardType.validate()', () => {
  it('returns valid for a well-formed card type', () => {
    const ct = makeCardType();
    const result = ct.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on missing id', () => {
    const state = makeState({ cardTypes: [makeCardTypeData({ id: '' })] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const result = ct.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('errors on missing name', () => {
    const state = makeState({ cardTypes: [makeCardTypeData({ name: '' })] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const result = ct.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('errors on invalid field type', () => {
    const state = makeState({
      cardTypes: [makeCardTypeData({ fields: [{ key: 'x', type: 'bogus' as never }] })],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const result = ct.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('bogus') || e.includes('invalid'))).toBe(true);
  });

  it('errors on missing field key', () => {
    const state = makeState({
      cardTypes: [makeCardTypeData({ fields: [{ key: '', type: 'text' }] })],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const result = ct.validate();
    expect(result.valid).toBe(false);
  });

  it('accepts all VALID_FIELD_TYPES', () => {
    const validTypes = [
      'text', 'select', 'multi-select', 'tags', 'url',
      'image', 'number', 'icon', 'qr', 'text-long',
      'richtext', 'background', 'pdf', 'computed',
    ] as const;
    for (const type of validTypes) {
      const state = makeState({
        cardTypes: [makeCardTypeData({ fields: [{ key: 'f', type }] })],
      });
      const project = Project.from(state);
      const ct = new CardType(project, project.cardTypes[0]);
      const result = ct.validate();
      expect(result.valid).toBe(true);
    }
  });
});

describe('CardType.validateComputedFields()', () => {
  it('returns empty array when no computed fields', () => {
    const ct = makeCardType();
    expect(ct.validateComputedFields()).toEqual([]);
  });

  it('returns empty array when computed fields have no cross-references', () => {
    const state = makeState({
      cardTypes: [makeCardTypeData({
        fields: [
          { key: 'power', type: 'number' },
          { key: 'doubled', type: 'computed', expression: 'power * 2' },
        ],
      })],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    expect(ct.validateComputedFields()).toEqual([]);
  });

  it('errors when a computed field references another computed field', () => {
    const state = makeState({
      cardTypes: [makeCardTypeData({
        fields: [
          { key: 'doubled', type: 'computed', expression: 'power * 2' },
          { key: 'quadrupled', type: 'computed', expression: 'doubled * 2' },
        ],
      })],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const errors = ct.validateComputedFields();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('quadrupled');
    expect(errors[0]).toContain('doubled');
  });
});

describe('CardType.getCards()', () => {
  it('returns cards for this type', () => {
    const ct = makeCardType();
    const cards = ct.getCards();
    expect(cards).toHaveLength(2);
  });

  it('returns same instances on repeated calls (cache)', () => {
    const ct = makeCardType();
    const first = ct.getCards();
    const second = ct.getCards();
    expect(second).toBe(first);
    expect(second[0]).toBe(first[0]);
  });

  it('filters by _type in multi-type projects', () => {
    const state = makeState({
      cardTypes: [
        makeCardTypeData({ id: 'hero', name: 'Hero' }),
        makeCardTypeData({ id: 'villain', name: 'Villain' }),
      ],
      data: [
        { name: 'Arthur', _type: 'hero' },
        { name: 'Mordred', _type: 'villain' },
        { name: 'Merlin', _type: 'hero' },
      ],
    });
    const project = Project.from(state);
    const heroCt = new CardType(project, project.cardTypes[0]);
    const cards = heroCt.getCards();
    expect(cards).toHaveLength(2);
    expect(cards.every(c => c.row._type === 'hero')).toBe(true);
  });

  it('returns ALL rows in single-type projects (no _type field)', () => {
    const state = makeState({
      data: [
        { name: 'Arthur', power: '5' },
        { name: 'Merlin', power: '8' },
        { name: 'Guinevere', power: '6' },
      ],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    expect(ct.getCards()).toHaveLength(3);
  });

  it('returns empty array when project has no data', () => {
    const state = makeState({ data: [] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    expect(ct.getCards()).toHaveLength(0);
  });
});

describe('CardType.getCard()', () => {
  it('returns the card at index', () => {
    const ct = makeCardType();
    const card = ct.getCard(0);
    expect(card).not.toBeNull();
    expect(card!.row.name).toBe('Arthur');
  });

  it('returns null for out-of-bounds index', () => {
    const ct = makeCardType();
    expect(ct.getCard(99)).toBeNull();
    expect(ct.getCard(-1)).toBeNull();
  });

  it('returns second card at index 1', () => {
    const ct = makeCardType();
    const card = ct.getCard(1);
    expect(card!.row.name).toBe('Merlin');
  });
});

describe('Card wrapper', () => {
  it('has a row reference', () => {
    const ct = makeCardType();
    const card = ct.getCards()[0];
    expect(card.row).toBeDefined();
    expect(card.row.name).toBe('Arthur');
  });

  it('getField() returns field value', () => {
    const ct = makeCardType();
    const card = ct.getCards()[0];
    expect(card.getField('name')).toBe('Arthur');
  });

  it('setField() mutates the row', () => {
    const state = makeState();
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const card = ct.getCards()[0];
    card.setField('name', 'Lancelot');
    expect(card.getField('name')).toBe('Lancelot');
    expect(state.data[0].name).toBe('Lancelot');
  });
});

describe('CardType.addCard()', () => {
  it('adds a row to project.data with _type set', () => {
    const state = makeState();
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    ct.addCard({ name: 'Gawain', power: '7' });
    expect(project.data).toHaveLength(3);
    expect(project.data[2]._type).toBe('hero');
  });

  it('returns a Card for the new row', () => {
    const ct = makeCardType();
    const card = ct.addCard({ name: 'Gawain' });
    expect(card).toBeDefined();
    expect(card.getField('name')).toBe('Gawain');
  });

  it('works with no rowData (empty card)', () => {
    const ct = makeCardType();
    const card = ct.addCard();
    expect(card).toBeDefined();
    expect(card.row._type).toBe('hero');
  });

  it('invalidates cache — getCards() reflects new card', () => {
    const ct = makeCardType();
    const before = ct.getCards();
    expect(before).toHaveLength(2);

    ct.addCard({ name: 'Gawain' });
    const after = ct.getCards();
    expect(after).toHaveLength(3);
    expect(after).not.toBe(before);
  });

  it('getCards() returns same instances after second add (re-cached)', () => {
    const ct = makeCardType();
    ct.addCard({ name: 'Gawain' });
    const first = ct.getCards();
    const second = ct.getCards();
    expect(second).toBe(first);
  });
});

describe('CardType.removeCard()', () => {
  it('removes the card from project.data', () => {
    const state = makeState();
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const card = ct.getCards()[0];
    ct.removeCard(card);
    expect(project.data).toHaveLength(1);
    expect(project.data[0].name).toBe('Merlin');
  });

  it('invalidates cache — getCards() reflects removal', () => {
    const ct = makeCardType();
    const before = ct.getCards();
    expect(before).toHaveLength(2);

    const first = before[0];
    ct.removeCard(first);
    const after = ct.getCards();
    expect(after).toHaveLength(1);
    expect(after).not.toBe(before);
  });
});

describe('CardType.exportCsv()', () => {
  it('returns a CSV string with header row', () => {
    const ct = makeCardType();
    const csv = ct.exportCsv();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('power');
  });

  it('includes card data rows', () => {
    const ct = makeCardType();
    const csv = ct.exportCsv();
    expect(csv).toContain('Arthur');
    expect(csv).toContain('Merlin');
  });

  it('excludes computed fields from CSV', () => {
    const state = makeState({
      cardTypes: [makeCardTypeData({
        fields: [
          { key: 'name', type: 'text' },
          { key: 'doubled', type: 'computed', expression: 'power * 2' },
        ],
      })],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const csv = ct.exportCsv();
    const header = csv.split('\n')[0];
    expect(header).toContain('name');
    expect(header).not.toContain('doubled');
  });

  it('quotes values with commas', () => {
    const state = makeState({
      data: [{ name: 'Hello, World', _type: 'hero' }],
    });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const csv = ct.exportCsv();
    expect(csv).toContain('"Hello, World"');
  });

  it('returns just the header for empty data', () => {
    const state = makeState({ data: [] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const csv = ct.exportCsv();
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});

describe('CardType.fromUpload()', () => {
  const schema = {
    id: 'upload-type',
    name: 'Upload Type',
    fields: [{ key: 'title', type: 'text' as const }],
    cardSize: { width: '63.5mm', height: '88.9mm' },
  };

  it('returns a ForgeCardType object', () => {
    const result = CardType.fromUpload(schema, '<div>{{title}}</div>', null, '');
    expect(result.id).toBe('upload-type');
    expect(result.name).toBe('Upload Type');
  });

  it('sanitizes the front template', () => {
    const result = CardType.fromUpload(
      schema,
      '<div><script>alert(1)</script>{{title}}</div>',
      null,
      '',
    );
    expect(result.frontTemplate).not.toContain('<script>');
    expect(result.frontTemplate).toContain('<!-- script removed -->');
  });

  it('sanitizes back template when provided', () => {
    const result = CardType.fromUpload(
      schema,
      '<div>{{title}}</div>',
      '<back onclick="x()">{{title}}</back>',
      '',
    );
    expect(result.backTemplate).not.toContain('onclick');
  });

  it('sets backTemplate to null when not provided', () => {
    const result = CardType.fromUpload(schema, '<div>{{title}}</div>', null, '');
    expect(result.backTemplate).toBeNull();
  });

  it('throws when id is missing', () => {
    expect(() =>
      CardType.fromUpload({ ...schema, id: '' }, '<div/>', null, ''),
    ).toThrow();
  });

  it('throws when front template is empty', () => {
    expect(() => CardType.fromUpload(schema, '   ', null, '')).toThrow();
  });

  it('sets _sanitizeCss flag', () => {
    const result = CardType.fromUpload(schema, '<div/>', null, '') as any;
    expect(result._sanitizeCss).toBe(true);
  });
});

describe('CardType.fromBundle()', () => {
  const bundle = {
    id: 'bundle-type',
    name: 'Bundle Type',
    fields: [{ key: 'title', type: 'text' as const }],
    frontTemplate: '<div>{{title}}</div>',
    cardSize: { width: '63.5mm', height: '88.9mm' },
  };

  it('returns a ForgeCardType object', () => {
    const result = CardType.fromBundle(bundle);
    expect(result.id).toBe('bundle-type');
    expect(result.name).toBe('Bundle Type');
  });

  it('sanitizes templates for non-built-in bundles', () => {
    const result = CardType.fromBundle({
      ...bundle,
      frontTemplate: '<div><script>x()</script></div>',
    });
    expect(result.frontTemplate).toContain('<!-- script removed -->');
  });

  it('does NOT sanitize for _builtIn bundles', () => {
    const raw = '<div><script>x()</script></div>';
    const result = CardType.fromBundle({
      ...bundle,
      frontTemplate: raw,
      _builtIn: true,
    } as typeof bundle & { _builtIn: boolean });
    expect(result.frontTemplate).toBe(raw);
  });

  it('throws when id is missing', () => {
    expect(() => CardType.fromBundle({ ...bundle, id: '' })).toThrow();
  });

  it('throws when frontTemplate is missing', () => {
    expect(() =>
      CardType.fromBundle({ ...bundle, frontTemplate: '' }),
    ).toThrow();
  });

  it('uses bundle.styles as css when bundle.css is absent', () => {
    const result = CardType.fromBundle({ ...bundle, styles: '.card{}' } as any);
    expect(result.css).toBe('.card{}');
  });
});

describe('CardType.getScopedCss()', () => {
  it('scopes CSS selectors with data-card-type attribute', () => {
    const state = makeState({ cardTypes: [makeCardTypeData({ css: '.card { color: red; }' })] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const scoped = ct.getScopedCss();
    expect(scoped).toContain('[data-card-type="hero"]');
    expect(scoped).toContain('.card');
  });

  it('scopes body selector to card type', () => {
    const state = makeState({ cardTypes: [makeCardTypeData({ css: 'body { background: blue; }' })] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const scoped = ct.getScopedCss();
    expect(scoped).toContain('[data-card-type="hero"] {');
    expect(scoped).not.toContain('body');
  });

  it('already-scoped selectors are left unchanged', () => {
    const css = '[data-card-type="hero"] .card { color: red; }';
    const state = makeState({ cardTypes: [makeCardTypeData({ css })] });
    const project = Project.from(state);
    const ct = new CardType(project, project.cardTypes[0]);
    const scoped = ct.getScopedCss();
    expect(scoped).not.toContain('[data-card-type="hero"] [data-card-type');
  });
});
