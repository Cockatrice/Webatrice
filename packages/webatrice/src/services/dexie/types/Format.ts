export interface AllowedCount {
  max: string;
  label: string;
}

export class Format {
  formatName: string;
  minDeckSize?: number;
  maxDeckSize?: number;
  maxSideboardSize?: number;
  allowedCounts?: AllowedCount[];
}
