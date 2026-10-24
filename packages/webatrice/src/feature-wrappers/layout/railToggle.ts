export const RAIL_TOGGLE_ID = 'nav-rail-toggle';

export function focusRailToggle(): void {
  document.getElementById(RAIL_TOGGLE_ID)?.focus();
}
