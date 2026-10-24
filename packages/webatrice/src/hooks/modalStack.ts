const stack: HTMLElement[] = [];
const previous = new Map<HTMLElement, boolean>();
let observer: MutationObserver | undefined;

function restore() {
  for (const [element, inert] of previous) {
    element.toggleAttribute('inert', inert);
  }
  previous.clear();
}

function refresh() {
  restore();
  observer?.disconnect();
  const top = stack.at(-1);
  if (!top) {
    return;
  }
  let branch: HTMLElement = top.closest<HTMLElement>('[data-modal-layer],.MuiModal-root') ?? top;
  while (branch.parentElement) {
    const parent = branch.parentElement;
    observer?.observe(parent, { childList: true });
    for (const sibling of parent.children) {
      if (sibling !== branch && sibling instanceof HTMLElement && !sibling.hasAttribute('data-modal-exempt')) {
        previous.set(sibling, sibling.hasAttribute('inert'));
        sibling.setAttribute('inert', '');
      }
    }
    if (parent === document.body) {
      break;
    }
    branch = parent;
  }
}

function containFocus(event: FocusEvent) {
  const top = stack.at(-1);
  const layer = top?.closest('[data-modal-layer],.MuiModal-root') ?? top;
  const exempt = event.target instanceof Element && event.target.closest('[data-modal-exempt]');
  if (top && event.target instanceof Node && !layer?.contains(event.target) && !exempt) {
    top.focus({ preventScroll: true });
  }
}

export function registerModal(element: HTMLElement): () => void {
  stack.push(element);
  if (!observer) {
    observer = new MutationObserver(refresh);
    document.addEventListener('focusin', containFocus);
  }
  refresh();
  return () => {
    const index = stack.indexOf(element);
    if (index >= 0) {
      stack.splice(index, 1);
    }
    refresh();
    if (stack.length === 0) {
      observer?.disconnect();
      observer = undefined;
      document.removeEventListener('focusin', containFocus);
    }
  };
}
