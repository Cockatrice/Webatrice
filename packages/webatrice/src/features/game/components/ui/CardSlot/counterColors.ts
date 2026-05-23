// See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
export const COUNTER_TYPE_COUNT = 6;
export const COUNTER_TYPE_LABELS: ReadonlyArray<string> = ['A', 'B', 'C', 'D', 'E', 'F'];

export function counterColorForId(id: number): string {
  const hue = (id * 60) % 360;
  return `hsl(${hue}, 59%, 70%)`;
}
