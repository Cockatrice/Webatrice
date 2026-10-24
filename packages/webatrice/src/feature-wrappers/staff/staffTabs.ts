export function staffTabIds(prefix: string, value: string): { tab: string; panel: string } {
  return { tab: `${prefix}-tab-${value}`, panel: `${prefix}-panel` };
}

export function tabKeyTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
