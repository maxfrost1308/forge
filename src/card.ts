import type { CardType } from './card-type.ts';
import type { ForgeRow, RenderOptions, RenderResult } from './types.ts';

import {
  renderFullCard,
  evaluateExpression,
} from './template-renderer.js';

export class Card {
  private readonly _cardType: CardType;
  private readonly _row: ForgeRow;
  private readonly _index: number;

  constructor(cardType: CardType, row: ForgeRow, index: number) {
    this._cardType = cardType;
    this._row = row;
    this._index = index;
  }

  get cardType(): CardType {
    return this._cardType;
  }

  get index(): number {
    return this._index;
  }

  getField(key: string): unknown {
    return this._row[key];
  }

  setField(key: string, value: unknown): void {
    this._row[key] = value;
  }

  render(options: RenderOptions = {}): RenderResult | null {
    const { side = 'front', templateOverride } = options;
    const project = this._cardType.project;
    const cardTypeId = this._cardType.id;

    const rawCardType = project.getCardType(cardTypeId);
    if (!rawCardType) return null;

    let effectiveCardType = rawCardType;
    if (templateOverride) {
      effectiveCardType = side === 'back'
        ? { ...rawCardType, backTemplate: templateOverride }
        : { ...rawCardType, frontTemplate: templateOverride };
    }

    const projectLike = {
      cardTypes: project.cardTypes.map((ct) =>
        ct.id === cardTypeId ? effectiveCardType : ct,
      ),
      data: project.data,
      globalVariables: project.globalVariables,
      assets: project.assets,
      fonts: project.fonts,
    };

    return renderFullCard(projectLike, cardTypeId, this._row, { side }) as RenderResult | null;
  }

  evaluateComputed(): void {
    const fields = this._cardType.fields;
    for (const field of fields) {
      if (field.type === 'computed' && field.expression) {
        this._row[field.key] = evaluateExpression(
          field.expression,
          this._row as Record<string, unknown>,
        );
      }
    }
  }
}
