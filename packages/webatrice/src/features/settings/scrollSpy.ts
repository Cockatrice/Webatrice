export interface SectionTop {
  id: string;
  top: number;
}

export interface ScrollPosition {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export function sectionAt(tops: readonly SectionTop[], position: ScrollPosition, slack = 8): string | undefined {
  if (tops.length === 0) {
    return undefined;
  }
  if (position.scrollTop > 0 && position.scrollTop + position.clientHeight >= position.scrollHeight - 2) {
    return tops[tops.length - 1].id;
  }
  let current = tops[0];
  for (const entry of tops) {
    if (entry.top - slack <= position.scrollTop && entry.top > current.top) {
      current = entry;
    }
  }
  return current.id;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable === true;
}

export function isModalOpen(doc: Document = document): boolean {
  return doc.querySelector('[aria-modal="true"]') !== null;
}

export const sectionDomId = (id: string) => `settings-section-${id}`;
export const groupDomId = (id: string) => `settings-group-${id}`;
