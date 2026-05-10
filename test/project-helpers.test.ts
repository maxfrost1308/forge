import { describe, it, expect } from 'vitest';
import { Project } from '../src/project';
import { validateVariableName, evaluateExpression } from '../src/index';
import type { ForgeFont, ForgeAsset, ForgeProject } from '../src/types';

function makeMinimalState(): ForgeProject {
  return {
    name: 'Test Project',
    formatVersion: 5,
    cardTypes: [
      {
        id: 'cards',
        name: 'Cards',
        cardSize: { width: '63.5mm', height: '88.9mm' },
        fields: [{ key: 'title', type: 'text', label: 'Title' }],
        frontTemplate: '<div>{{title}}</div>',
        backTemplate: null,
        css: '',
        colorMapping: null,
        aggregations: null,
      },
    ],
    defaultCardType: 'cards',
    data: [],
    globalVariables: {},
    assets: {},
    fonts: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    cardSizePreset: null,
  };
}

describe('Project.buildFontFaceCss', () => {
  it('returns empty string when project has no fonts', () => {
    const p = Project.from(makeMinimalState());
    expect(p.buildFontFaceCss()).toBe('');
  });

  it('returns @font-face rules for project fonts', () => {
    const state = makeMinimalState();
    const font: ForgeFont = {
      data: 'data:font/ttf;base64,AAAA',
      type: 'font/ttf',
      family: 'MyFont',
    };
    state.fonts = { 'myfont.ttf': font };
    const p = Project.from(state);
    const css = p.buildFontFaceCss();
    expect(css).toContain('@font-face');
    expect(css).toContain('MyFont');
    expect(css).toContain('data:font/ttf;base64,AAAA');
  });

  it('includes font-display:swap in @font-face rule', () => {
    const state = makeMinimalState();
    state.fonts = {
      'bold.ttf': { data: 'data:font/ttf;base64,BBBB', type: 'font/ttf', family: 'BoldFont' },
    };
    const p = Project.from(state);
    expect(p.buildFontFaceCss()).toContain('font-display:swap');
  });

  it('generates rules for multiple fonts', () => {
    const state = makeMinimalState();
    state.fonts = {
      'a.ttf': { data: 'data:font/ttf;base64,AA', type: 'font/ttf', family: 'FontA' },
      'b.woff2': { data: 'data:font/woff2;base64,BB', type: 'font/woff2', family: 'FontB' },
    };
    const p = Project.from(state);
    const css = p.buildFontFaceCss();
    expect(css).toContain('FontA');
    expect(css).toContain('FontB');
  });

  it('skips fonts without family property', () => {
    const state = makeMinimalState();
    state.fonts = {
      'nofamily.ttf': { data: 'data:font/ttf;base64,CC', type: 'font/ttf' },
    };
    const p = Project.from(state);
    expect(p.buildFontFaceCss()).toBe('');
  });
});

describe('Project.preprocessCssAssets', () => {
  it('returns css unchanged when no asset references', () => {
    const p = Project.from(makeMinimalState());
    const css = 'body { color: red; }';
    expect(p.preprocessCssAssets(css)).toBe(css);
  });

  it('replaces {{{asset:filename}}} with data URI from project assets', () => {
    const state = makeMinimalState();
    const asset: ForgeAsset = { data: 'data:image/png;base64,iVBORw0K', type: 'image/png' };
    state.assets = { 'bg.png': asset };
    const p = Project.from(state);
    const css = 'background: url({{{asset:bg.png}}});';
    const result = p.preprocessCssAssets(css);
    expect(result).toContain('data:image/png;base64,iVBORw0K');
    expect(result).not.toContain('{{{asset:');
  });

  it('resolves image/ prefixed asset keys', () => {
    const state = makeMinimalState();
    const asset: ForgeAsset = { data: 'data:image/png;base64,XYZ', type: 'image/png' };
    state.assets = { 'image/hero.png': asset };
    const p = Project.from(state);
    const css = 'background: url({{{asset:hero.png}}});';
    const result = p.preprocessCssAssets(css);
    expect(result).toContain('data:image/png;base64,XYZ');
  });

  it('returns empty string for empty css', () => {
    const p = Project.from(makeMinimalState());
    expect(p.preprocessCssAssets('')).toBe('');
  });
});

describe('validateVariableName (barrel export)', () => {
  it('returns valid for a valid name', () => {
    expect(validateVariableName('myVar')).toEqual({ valid: true });
  });

  it('returns invalid for name with spaces', () => {
    const result = validateVariableName('bad name');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns invalid for name starting with digit', () => {
    const result = validateVariableName('1abc');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for empty name', () => {
    const result = validateVariableName('');
    expect(result.valid).toBe(false);
  });

  it('allows underscores and alphanumerics', () => {
    expect(validateVariableName('my_var_2')).toEqual({ valid: true });
  });
});

describe('evaluateExpression (barrel export)', () => {
  it('evaluates a simple arithmetic expression', () => {
    expect(evaluateExpression('2 + 3', {})).toBe(5);
  });

  it('evaluates multiplication', () => {
    expect(evaluateExpression('4 * 5', {})).toBe(20);
  });

  it('evaluates with field data', () => {
    expect(evaluateExpression('qty * 2', { qty: 3 })).toBe(6);
  });

  it('returns 0 for invalid expression', () => {
    expect(evaluateExpression('invalid_expr_xyz', {})).toBe(0);
  });
});
