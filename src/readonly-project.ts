import type { Project } from './project.ts';
import type {
  ForgeCardType,
  ForgeAsset,
  ForgeFont,
  ForgeRow,
  ValidationResult,
} from './types.ts';

const MUTATION_ERROR = 'Cannot mutate a ReadonlyProject';

export class ReadonlyProject {
  static readonly FORMAT_VERSION = 5;
  private _project: Project;

  constructor(project: Project) {
    this._project = project;
  }

  get name(): string {
    return this._project.name;
  }

  set name(_value: string) {
    throw new Error(MUTATION_ERROR);
  }

  get cardTypes(): ForgeCardType[] {
    return this._project.cardTypes;
  }

  getCardType(id: string): ForgeCardType | null {
    return this._project.getCardType(id);
  }

  get globalVariables(): Record<string, string> {
    return this._project.globalVariables;
  }

  get assets(): Record<string, ForgeAsset> {
    return this._project.assets;
  }

  getAsset(name: string): ForgeAsset | null {
    return this._project.getAsset(name);
  }

  get fonts(): Record<string, ForgeFont> {
    return this._project.fonts;
  }

  get data(): ForgeRow[] {
    return this._project.data;
  }

  validate(): ValidationResult {
    return this._project.validate();
  }

  addCardType(_cardTypeData: ForgeCardType): never {
    throw new Error(MUTATION_ERROR);
  }

  removeCardType(_id: string): never {
    throw new Error(MUTATION_ERROR);
  }

  setVariable(_name: string, _value: string): never {
    throw new Error(MUTATION_ERROR);
  }

  removeVariable(_name: string): never {
    throw new Error(MUTATION_ERROR);
  }

  addAsset(_name: string, _asset: ForgeAsset): never {
    throw new Error(MUTATION_ERROR);
  }

  removeAsset(_name: string): never {
    throw new Error(MUTATION_ERROR);
  }

  addFont(_name: string, _font: ForgeFont): never {
    throw new Error(MUTATION_ERROR);
  }

  removeFont(_name: string): never {
    throw new Error(MUTATION_ERROR);
  }

  importCsv(_csvText: string, _cardTypeId?: string): never {
    throw new Error(MUTATION_ERROR);
  }
}
