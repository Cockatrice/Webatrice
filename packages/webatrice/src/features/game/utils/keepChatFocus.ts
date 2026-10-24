const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export function keepFocusOnBoardPress(e: Pick<MouseEvent, 'target' | 'preventDefault'>): void {
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest(EDITABLE)) {
    return;
  }
  e.preventDefault();
}
