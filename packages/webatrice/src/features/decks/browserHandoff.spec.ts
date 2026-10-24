import { openInNewTab, printHtml, saveTextFile, submitFormInNewTab } from './browserHandoff';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('saveTextFile', () => {
  it('downloads the content under the file name', () => {
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      clicked = document.querySelector('a');
    });
    try {
      saveTextFile('burn.cod', '<cockatrice_deck/>', 'application/xml');

      expect(clicked!.download).toBe('burn.cod');
      expect(clicked!.href).toBe('blob:x');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
      expect(document.querySelector('a')).toBeNull();
    } finally {
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    }
  });
});

describe('openInNewTab', () => {
  it('opens the URL in a new tab without an opener', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openInNewTab('https://www.decklist.org/?deckmain=1');
    expect(open).toHaveBeenCalledWith('https://www.decklist.org/?deckmain=1', '_blank', 'noopener,noreferrer');
  });
});

describe('submitFormInNewTab', () => {
  it('posts every field as a form into a new tab, then removes the form', () => {
    let submitted: HTMLFormElement | null = null;
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {
      submitted = document.querySelector('form');
    });

    submitFormInNewTab({ action: 'https://deckstats.net/index.php', fields: { deck: '4 Bolt\nSB: 1 Shock\n', decktitle: 'Burn' } });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submitted!.method).toBe('post');
    expect(submitted!.action).toBe('https://deckstats.net/index.php');
    expect(submitted!.target).toBe('_blank');
    expect(Object.fromEntries(new FormData(submitted!))).toEqual({ deck: '4 Bolt\nSB: 1 Shock\n', decktitle: 'Burn' });
    expect(document.querySelector('form')).toBeNull();
  });
});

describe('printHtml', () => {
  it('loads the page into a hidden frame', () => {
    printHtml('<h1>Burn</h1>');
    const frame = document.querySelector('iframe')!;
    expect(frame.srcdoc).toBe('<h1>Burn</h1>');
    expect(frame.getAttribute('aria-hidden')).toBe('true');
  });

  it('prints once loaded and removes the frame after printing', () => {
    printHtml('<h1>Burn</h1>');
    const frame = document.querySelector('iframe')!;
    const print = vi.fn();
    const listeners: Record<string, () => void> = {};
    Object.defineProperty(frame, 'contentWindow', {
      value: { focus: vi.fn(), print, addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      } },
    });

    frame.onload!(new Event('load'));
    expect(print).toHaveBeenCalled();
    listeners.afterprint();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
