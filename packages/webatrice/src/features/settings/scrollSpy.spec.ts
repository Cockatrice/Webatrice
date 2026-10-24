import { isModalOpen, isTypingTarget, sectionAt } from './scrollSpy';

const tops = [
  { id: 'general', top: 0 },
  { id: 'appearance', top: 400 },
  { id: 'sound', top: 1200 },
];
const at = (scrollTop: number, clientHeight = 500, scrollHeight = 2000) => sectionAt(tops, { scrollTop, clientHeight, scrollHeight });

describe('sectionAt', () => {
  it('picks the last section whose top has scrolled past, with a little slack', () => {
    expect(at(0)).toBe('general');
    expect(at(391)).toBe('general');
    expect(at(392)).toBe('appearance');
    expect(at(1100)).toBe('appearance');
    expect(at(1200)).toBe('sound');
  });

  it('picks the last section once the page is scrolled to the bottom, even if it is short', () => {
    const short = [...tops, { id: 'shortcuts', top: 1900 }];
    expect(sectionAt(short, { scrollTop: 1500, clientHeight: 500, scrollHeight: 2000 })).toBe('shortcuts');
  });

  it('stays on the first of sections that share a top, as before layout', () => {
    expect(sectionAt([{ id: 'a', top: 0 }, { id: 'b', top: 0 }], { scrollTop: 0, clientHeight: 0, scrollHeight: 0 })).toBe('a');
  });

  it('stays on the first section when nothing scrolls', () => {
    expect(sectionAt(tops, { scrollTop: 0, clientHeight: 500, scrollHeight: 500 })).toBe('general');
    expect(sectionAt([], { scrollTop: 0, clientHeight: 0, scrollHeight: 0 })).toBeUndefined();
  });
});

describe('isTypingTarget', () => {
  it('is true for fields and editable content only', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isModalOpen', () => {
  it('sees an open modal dialog', () => {
    expect(isModalOpen()).toBe(false);
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    expect(isModalOpen()).toBe(true);
    dialog.remove();
  });
});
