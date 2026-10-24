export function planHandReorder(
  handOrder: readonly string[],
  draggedIds: readonly string[],
  targetIndex: number,
): { cardId: string; x: number }[] {
  const dragged = new Set(draggedIds);
  const group = handOrder.filter((id) => dragged.has(id));
  const others = handOrder.filter((id) => !dragged.has(id));
  const anchor = others[Math.max(0, Math.min(targetIndex, others.length))];

  const order = handOrder.slice();
  const plan: { cardId: string; x: number }[] = [];
  let previous: string | undefined;
  for (const cardId of group) {
    order.splice(order.indexOf(cardId), 1);
    const x = previous !== undefined
      ? order.indexOf(previous) + 1
      : anchor !== undefined ? order.indexOf(anchor) : order.length;
    order.splice(x, 0, cardId);
    plan.push({ cardId, x });
    previous = cardId;
  }
  return plan;
}

export function planPositionalReorder(
  positions: readonly number[],
  targetIndex: number,
): { cardId: number; x: number }[] {
  const moved = [...new Set(positions)].sort((a, b) => a - b);
  if (moved.length === 0) {
    return [];
  }
  const length = Math.max(moved[moved.length - 1] + 1, targetIndex + moved.length);
  const order = Array.from({ length }, (_, i) => String(i));
  const current = order.slice();
  return planHandReorder(order, moved.map(String), targetIndex).map(({ cardId, x }) => {
    const position = current.indexOf(cardId);
    current.splice(position, 1);
    current.splice(x, 0, cardId);
    return { cardId: position, x };
  });
}
