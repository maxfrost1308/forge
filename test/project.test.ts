import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import type { ForgeProject, ForgeCardType, ForgeAsset, ForgeFont } from '../src/types';

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

function makeMinimalState(): ForgeProject {
  return {
    name: 'Test Project',
    formatVersion: 5,
    cardTypes: [makeCardType()],
    defaultCardType: 'cards',
    data: [{ title: 'Card 1', _type: 'cards' }],
    globalVariables: {},
    assets: {},
    fonts: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    cardSizePreset: null,
  };
}

describe('Project.FORMAT_VERSION', () => {
  it('equals 5', () => {
    expect(Project.FORMAT_VERSION).toBe(5);
  });
});

describe('Project.fromScratch', () => {
  it('creates project with given name', () => {
    const p = Project.fromScratch({ name: 'My Game' });
    expect(p.name).toBe('My Game');
  });

  it('has empty cardTypes array', () => {
    const p = Project.fromScratch({ name: 'My Game' });
    expect(p.cardTypes).toEqual([]);
  });

  it('has empty data array', () => {
    const p = Project.fromScratch({ name: 'My Game' });
    expect(p.data).toEqual([]);
  });

  it('has empty globalVariables', () => {
    const p = Project.fromScratch({ name: 'My Game' });
    expect(p.globalVariables).toEqual({});
  });

  it('has empty assets', () => {
    const p = Project.fromScratch({ name: 'My Game' });
    expect(p.assets).toEqual({});
  });

  it('has empty fonts', () => {
    const p = Project.fromScratch({ name: 'My Game' });
    expect(p.fonts).toEqual({});
  });
});

describe('Project.from', () => {
  it('wraps state by reference — name mutation visible in original', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    p.name = 'Changed';
    expect(state.name).toBe('Changed');
  });

  it('wraps state by reference — variable mutation visible in original', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    p.setVariable('theme', 'dark');
    expect(state.globalVariables['theme']).toBe('dark');
  });

  it('wraps state by reference — addCardType mutates original cardTypes array', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    const newCt = makeCardType({ id: 'spells', name: 'Spells' });
    p.addCardType(newCt);
    expect(state.cardTypes).toHaveLength(2);
    expect(state.cardTypes[1].id).toBe('spells');
  });

  it('wraps state by reference — data getter returns same array reference', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    expect(p.data).toBe(state.data);
  });

  it('wraps state by reference — assets mutation visible in original', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    const asset: ForgeAsset = { data: 'data:image/png;base64,abc', type: 'image/png' };
    p.addAsset('icon.png', asset);
    expect(state.assets['icon.png']).toBe(asset);
  });
});

describe('name', () => {
  it('getter returns current name', () => {
    const p = Project.fromScratch({ name: 'Alpha' });
    expect(p.name).toBe('Alpha');
  });

  it('setter updates name', () => {
    const p = Project.fromScratch({ name: 'Alpha' });
    p.name = 'Beta';
    expect(p.name).toBe('Beta');
  });
});

describe('data', () => {
  it('returns the data array reference', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    expect(p.data).toBe(state.data);
    expect(p.data).toHaveLength(1);
  });
});

describe('cardTypes', () => {
  it('returns raw ForgeCardType array', () => {
    const p = Project.from(makeMinimalState());
    expect(p.cardTypes).toHaveLength(1);
    expect(p.cardTypes[0].id).toBe('cards');
    expect(p.cardTypes[0].name).toBe('Cards');
  });
});

describe('getCardType', () => {
  it('returns matching card type', () => {
    const p = Project.from(makeMinimalState());
    const ct = p.getCardType('cards');
    expect(ct).not.toBeNull();
    expect(ct!.id).toBe('cards');
  });

  it('returns null for unknown id', () => {
    const p = Project.from(makeMinimalState());
    expect(p.getCardType('unknown')).toBeNull();
  });
});

describe('addCardType', () => {
  it('adds a new card type and returns it', () => {
    const p = Project.fromScratch({ name: 'Test' });
    const ct = makeCardType({ id: 'spells', name: 'Spells' });
    const added = p.addCardType(ct);
    expect(added).toBe(ct);
    expect(p.cardTypes).toHaveLength(1);
    expect(p.cardTypes[0].id).toBe('spells');
  });

  it('can add multiple card types', () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.addCardType(makeCardType({ id: 'a', name: 'A' }));
    p.addCardType(makeCardType({ id: 'b', name: 'B' }));
    expect(p.cardTypes).toHaveLength(2);
  });
});

describe('removeCardType', () => {
  it('removes the card type by id', () => {
    const p = Project.from(makeMinimalState());
    p.removeCardType('cards');
    expect(p.cardTypes).toHaveLength(0);
  });

  it('removes data rows belonging to the card type', () => {
    const state: ForgeProject = {
      ...makeMinimalState(),
      data: [
        { title: 'C1', _type: 'cards' },
        { title: 'C2', _type: 'cards' },
        { title: 'S1', _type: 'spells' },
      ],
      cardTypes: [
        makeCardType({ id: 'cards' }),
        makeCardType({ id: 'spells', name: 'Spells' }),
      ],
    };
    const p = Project.from(state);
    p.removeCardType('cards');
    expect(p.data).toHaveLength(1);
    expect(p.data[0]._type).toBe('spells');
  });

  it('does nothing for unknown id', () => {
    const p = Project.from(makeMinimalState());
    p.removeCardType('nonexistent');
    expect(p.cardTypes).toHaveLength(1);
  });
});

describe('globalVariables', () => {
  it('returns variables object reference', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    expect(p.globalVariables).toBe(state.globalVariables);
  });
});

describe('setVariable', () => {
  it('sets a valid variable', () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.setVariable('theme', 'dark');
    expect(p.globalVariables['theme']).toBe('dark');
  });

  it('throws for invalid name (spaces)', () => {
    const p = Project.fromScratch({ name: 'Test' });
    expect(() => p.setVariable('bad name', 'value')).toThrow();
  });

  it('throws for name starting with digit', () => {
    const p = Project.fromScratch({ name: 'Test' });
    expect(() => p.setVariable('1badName', 'value')).toThrow();
  });

  it('allows underscores and alphanumerics', () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.setVariable('my_var_2', 'ok');
    expect(p.globalVariables['my_var_2']).toBe('ok');
  });
});

describe('removeVariable', () => {
  it('removes a variable', () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.setVariable('x', 'val');
    p.removeVariable('x');
    expect(p.globalVariables['x']).toBeUndefined();
  });

  it('does nothing for non-existent variable', () => {
    const p = Project.fromScratch({ name: 'Test' });
    expect(() => p.removeVariable('nonexistent')).not.toThrow();
  });
});

describe('assets', () => {
  it('returns assets object reference', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    expect(p.assets).toBe(state.assets);
  });
});

describe('addAsset / getAsset / removeAsset', () => {
  it('adds and retrieves an asset', () => {
    const p = Project.fromScratch({ name: 'Test' });
    const asset: ForgeAsset = { data: 'data:image/png;base64,abc', type: 'image/png' };
    p.addAsset('icon.png', asset);
    expect(p.getAsset('icon.png')).toBe(asset);
  });

  it('getAsset returns null for unknown key', () => {
    const p = Project.fromScratch({ name: 'Test' });
    expect(p.getAsset('missing.png')).toBeNull();
  });

  it('removes an asset', () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.addAsset('icon.png', { data: 'data:image/png;base64,abc', type: 'image/png' });
    p.removeAsset('icon.png');
    expect(p.getAsset('icon.png')).toBeNull();
  });
});

describe('fonts', () => {
  it('returns fonts object reference', () => {
    const state = makeMinimalState();
    const p = Project.from(state);
    expect(p.fonts).toBe(state.fonts);
  });
});

describe('addFont / removeFont', () => {
  it('adds a font', () => {
    const p = Project.fromScratch({ name: 'Test' });
    const font: ForgeFont = { data: 'data:font/ttf;base64,abc', type: 'font/ttf', family: 'MyFont' };
    p.addFont('myfont.ttf', font);
    expect(p.fonts['myfont.ttf']).toBe(font);
  });

  it('removes a font', () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.addFont('myfont.ttf', { data: 'data:font/ttf;base64,abc', type: 'font/ttf' });
    p.removeFont('myfont.ttf');
    expect(p.fonts['myfont.ttf']).toBeUndefined();
  });
});

describe('importCsv', () => {
  it('parses CSV and appends rows to data', async () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.addCardType(makeCardType());
    await p.importCsv('title\nCard A\nCard B', 'cards');
    expect(p.data).toHaveLength(2);
    expect(p.data[0].title).toBe('Card A');
    expect(p.data[1].title).toBe('Card B');
  });

  it('assigns _type from cardTypeId param', async () => {
    const p = Project.fromScratch({ name: 'Test' });
    p.addCardType(makeCardType({ id: 'spells', name: 'Spells' }));
    await p.importCsv('title\nFireball', 'spells');
    expect(p.data[0]._type).toBe('spells');
  });

  it('falls back to defaultCardType if no cardTypeId given', async () => {
    const state = makeMinimalState();
    state.data = [];
    const p = Project.from(state);
    await p.importCsv('title\nFoo');
    expect(p.data[0]._type).toBe('cards');
  });
});

describe('validate', () => {
  it('returns valid for a proper project', () => {
    const p = Project.from(makeMinimalState());
    const result = p.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid when cardType has no id', () => {
    const state = makeMinimalState();
    state.cardTypes[0] = { ...state.cardTypes[0], id: '' };
    const p = Project.from(state);
    const result = p.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid when no card types', () => {
    const p = Project.fromScratch({ name: 'Empty' });
    const result = p.validate();
    expect(result.valid).toBe(false);
  });
});

describe('save / load round-trip', () => {
  it('save returns ArrayBuffer', async () => {
    const p = Project.from(makeMinimalState());
    const buf = await p.save();
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('load deserializes a saved project', async () => {
    const p1 = Project.fromScratch({ name: 'Round-trip Test' });
    p1.addCardType(makeCardType({ id: 'ct1', name: 'Type One' }));
    const buf = await p1.save();

    const p2 = await Project.load(buf);
    expect(p2.name).toBe('Round-trip Test');
    expect(p2.cardTypes).toHaveLength(1);
    expect(p2.cardTypes[0].id).toBe('ct1');
    expect(p2.cardTypes[0].frontTemplate).toBe('<div>{{title}}</div>');
  });

  it('round-trips data rows', async () => {
    const state = makeMinimalState();
    const p1 = Project.from(state);
    const buf = await p1.save();
    const p2 = await Project.load(buf);
    expect(p2.data).toHaveLength(1);
    expect(p2.data[0].title).toBe('Card 1');
  });

  it('round-trips globalVariables', async () => {
    const p1 = Project.from(makeMinimalState());
    p1.setVariable('version', '1');
    const buf = await p1.save();
    const p2 = await Project.load(buf);
    expect(p2.globalVariables['version']).toBe('1');
  });

  it('round-trips assets', async () => {
    const p1 = Project.from(makeMinimalState());
    p1.addAsset('image/hero.png', {
      data: 'data:image/png;base64,iVBORw0KGgo=',
      type: 'image/png',
    });
    const buf = await p1.save();
    const p2 = await Project.load(buf);
    const loaded = p2.getAsset('image/hero.png') || p2.getAsset('hero.png');
    expect(loaded).not.toBeNull();
    expect(loaded!.type).toBe('image/png');
  });
});

describe('saveTemplateOnly', () => {
  it('returns ArrayBuffer', async () => {
    const p = Project.from(makeMinimalState());
    const buf = await p.saveTemplateOnly();
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('result can be loaded as a project', async () => {
    const p = Project.from(makeMinimalState());
    const buf = await p.saveTemplateOnly();
    const loaded = await Project.load(buf);
    expect(loaded.cardTypes).toHaveLength(1);
    expect(loaded.cardTypes[0].id).toBe('cards');
  });
});
