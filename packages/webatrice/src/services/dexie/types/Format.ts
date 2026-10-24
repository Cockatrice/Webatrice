export interface AllowedCount {
  max: string;
  label: string;
}

export interface CardCondition {
  field: string;
  match: string;
  value: string;
}

export interface FormatException {
  maxCopies: string;
  conditions: CardCondition[];
}

export class Format {
  formatName: string;
  minDeckSize?: number;
  maxDeckSize?: number;
  maxSideboardSize?: number;
  allowedCounts?: AllowedCount[];
  exceptions?: FormatException[];
}
