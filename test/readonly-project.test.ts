import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import { ReadonlyProject } from '../src/readonly-project';
import type { ForgeProject, ForgeCardType } from '../src/types';

function makeCardType(overrides: Partial<ForgeCardType> = {}): ForgeCardType {
  return {
    id: 'cards',
    name: 'Cards',
    cardSize: { width: '63.5mm', height: '88.9mm' },
    fields: [{ key: 'title', type: 'text', label: 'Title' }],
    frontTemplate: '<div>{{title}}</div>',
    backTemplate: null,
    css: '',
    colorMapping: null,
    aggregations: null,
    ...overrides,
  };
}

function makeState(): ForgeProject {
  return {
    name: 'Test Project',
    formatVersion: 5,
    cardTypes: [makeCardType(), makeCardType({ id: 'spells', name: 'Spells' })],
    defaultCardType: 'cards',
    data: [
      { title: 'Card 1', _type: 'cards' },
      { title: 'Fireball', _type: 'spells' },
    ],
    globalVariables: { author: 'Alice', version: '1' },
    assets: { 'image/bg.png': { data: 'data:image/png;base64,abc', type: 'image/png' } },
    fonts: { 'custom.ttf': { data: 'data:font/ttf;base64,xyz', type: 'font/ttf', family: 'Custom' } },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    cardSizePreset: null,
  };
}

function makeReadonly(): ReadonlyProject {
  return new ReadonlyProject(Project.from(makeState()));
}

const MUTATION_ERROR = 'Cannot mutate a ReadonlyProject';

describe('ReadonlyProject.FORMAT_VERSION', () => {
  it('equals 5', () => {
    expect(ReadonlyProject.FORMAT_VERSION).toBe(5);
  });
});

describe('ReadonlyProject — read access', () => {
  it('returns project name', () => {
    expect(makeReadonly().name).toBe('Test Project');
  });

  it('returns cardTypes array', () => {
    const r = makeReadonly();
    expect(r.cardTypes).toHaveLength(2);
    expect(r.cardTypes[0].id).toBe('cards');
    expect(r.cardTypes[1].id).toBe('spells');
  });

  it('getCardType returns matching card type', () => {
    expect(makeReadonly().getCardType('spells')?.name).toBe('Spells');
  });

  it('getCardType returns null for missing id', () => {
    expect(makeReadonly().getCardType('nonexistent')).toBeNull();
  });

  it('returns globalVariables', () => {
    const vars = makeReadonly().globalVariables;
    expect(vars).toEqual({ author: 'Alice', version: '1' });
  });

  it('returns assets', () => {
    const assets = makeReadonly().assets;
    expect(Object.keys(assets)).toContain('image/bg.png');
  });

  it('getAsset returns matching asset', () => {
    expect(makeReadonly().getAsset('image/bg.png')?.type).toBe('image/png');
  });

  it('getAsset returns null for missing asset', () => {
    expect(makeReadonly().getAsset('missing.png')).toBeNull();
  });

  it('returns fonts', () => {
    const fonts = makeReadonly().fonts;
    expect(fonts['custom.ttf'].family).toBe('Custom');
  });

  it('returns data array', () => {
    const data = makeReadonly().data;
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('Card 1');
  });

  it('validate() works', () => {
    const result = makeReadonly().validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('ReadonlyProject — mutations throw', () => {
  it('setting name throws', () => {
    const r = makeReadonly();
    expect(() => { (r as unknown as { name: string }).name = 'new'; }).toThrow(MUTATION_ERROR);
  });

  it('addCardType throws', () => {
    expect(() => makeReadonly().addCardType(makeCardType({ id: 'x' }))).toThrow(MUTATION_ERROR);
  });

  it('removeCardType throws', () => {
    expect(() => makeReadonly().removeCardType('cards')).toThrow(MUTATION_ERROR);
  });

  it('setVariable throws', () => {
    expect(() => makeReadonly().setVariable('foo', 'bar')).toThrow(MUTATION_ERROR);
  });

  it('removeVariable throws', () => {
    expect(() => makeReadonly().removeVariable('author')).toThrow(MUTATION_ERROR);
  });

  it('addAsset throws', () => {
    expect(() => makeReadonly().addAsset('x.png', { data: '', type: 'image/png' })).toThrow(MUTATION_ERROR);
  });

  it('removeAsset throws', () => {
    expect(() => makeReadonly().removeAsset('image/bg.png')).toThrow(MUTATION_ERROR);
  });

  it('addFont throws', () => {
    expect(() => makeReadonly().addFont('x.ttf', { data: '', type: 'font/ttf' })).toThrow(MUTATION_ERROR);
  });

  it('removeFont throws', () => {
    expect(() => makeReadonly().removeFont('custom.ttf')).toThrow(MUTATION_ERROR);
  });

  it('importCsv throws', () => {
    expect(() => makeReadonly().importCsv('title\nHello')).toThrow(MUTATION_ERROR);
  });
});

describe('ReadonlyProject — rendering still works', () => {
  it('card types have accessible fields and templates', () => {
    const r = makeReadonly();
    const ct = r.cardTypes[0];
    expect(ct.fields[0].key).toBe('title');
    expect(ct.frontTemplate).toBe('<div>{{title}}</div>');
  });

  it('data rows are accessible with all properties', () => {
    const r = makeReadonly();
    expect(r.data[0]._type).toBe('cards');
    expect(r.data[1]._type).toBe('spells');
  });
});

describe('Project.readonly()', () => {
  it('returns a ReadonlyProject instance', () => {
    const p = Project.from(makeState());
    const r = p.readonly();
    expect(r).toBeInstanceOf(ReadonlyProject);
  });

  it('delegates to same underlying data', () => {
    const p = Project.from(makeState());
    const r = p.readonly();
    expect(r.name).toBe(p.name);
    expect(r.cardTypes).toBe(p.cardTypes);
    expect(r.data).toBe(p.data);
  });
});
