// Mirrors Cockatrice desktop's per-counter coloring scheme
// (cockatrice/src/client/settings/card_counter_settings.cpp): six counter
// types A-F, each with a hue derived from `id × 60°`. Cockatrice uses
// QColor::fromHsv(hue, 150, 255); the equivalent CSS HSL with comparable
// saturation/value is hsl(hue, 59%, 70%).
export const COUNTER_TYPE_COUNT = 6;
export const COUNTER_TYPE_LABELS: ReadonlyArray<string> = ['A', 'B', 'C', 'D', 'E', 'F'];

export function counterColorForId(id: number): string {
  const hue = (id * 60) % 360;
  return `hsl(${hue}, 59%, 70%)`;
}
