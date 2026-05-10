export class Setting {
  user: string;
  autoConnect?: boolean;
  invertVerticalCoordinate?: boolean;
  // Override map for keyboard shortcuts. Keys are ActionId strings (kept loose here to
  // avoid coupling this types module to the shortcuts module). Absent = use defaults.
  shortcuts?: Record<string, string[]>;
}

export const APP_USER = '*app';
