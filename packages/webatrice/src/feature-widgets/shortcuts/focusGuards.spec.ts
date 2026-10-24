import { isModalOpen, isTabNavigationKey, keepsTabNavigation } from './focusGuards';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('keepsTabNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves Tab to the shortcuts on the body and on plain board elements', () => {
    mount('<div id="board"><div id="card">Card</div></div>');
    expect(keepsTabNavigation(document.body)).toBe(false);
    expect(keepsTabNavigation(document.getElementById('card'))).toBe(false);
    expect(keepsTabNavigation(null)).toBe(false);
  });

  it('leaves Tab to the shortcuts on the board and on a card, whatever role the card has', () => {
    mount(
      '<div id="board" data-game-board tabindex="0">'
      + '<div id="card" data-card-id="7" role="button" aria-roledescription="draggable" tabindex="0">'
      + '<span id="name">Bear</span></div></div>',
    );
    expect(keepsTabNavigation(document.getElementById('board'))).toBe(false);
    expect(keepsTabNavigation(document.getElementById('card'))).toBe(false);
    expect(keepsTabNavigation(document.getElementById('name'))).toBe(false);
  });

  it('leaves Tab to the shortcuts on a zone\'s roving card option, while a pile button beside it keeps Tab', () => {
    mount(
      '<div data-game-board><div role="listbox"><div id="card" data-card-id="7" role="option" tabindex="0">Bear</div></div>'
      + '<button id="pile" type="button">Graveyard</button></div>',
    );
    expect(keepsTabNavigation(document.getElementById('card'))).toBe(false);
    expect(keepsTabNavigation(document.getElementById('pile'))).toBe(true);
  });

  it('leaves Tab to the shortcuts on a board scroller taken out of the tab order', () => {
    mount('<div data-game-board><div id="t" tabindex="-1" style="overflow-x:auto">cards</div></div>');
    expect(keepsTabNavigation(document.getElementById('t'))).toBe(false);
  });

  it('keeps Tab navigation on a scroller the browser made a tab stop, on the board or off it', () => {
    mount(
      '<div data-game-board><div id="info" style="overflow-y:auto"><div role="spinbutton" tabindex="0">20</div></div></div>'
      + '<div id="list" style="overflow:scroll">people</div>',
    );
    expect(keepsTabNavigation(document.getElementById('info'))).toBe(true);
    expect(keepsTabNavigation(document.getElementById('list'))).toBe(true);
  });

  it('keeps Tab navigation on a real control on the board', () => {
    mount('<div data-game-board><button id="t">Untap all</button></div>');
    expect(keepsTabNavigation(document.getElementById('t'))).toBe(true);
  });

  it('keeps Tab navigation on a card inside a dialog', () => {
    mount('<div role="dialog"><div id="t" data-card-id="7" role="button" tabindex="0">Bear</div></div>');
    expect(keepsTabNavigation(document.getElementById('t'))).toBe(true);
  });

  it.each([
    ['button', '<button id="t">Go</button>'],
    ['input', '<input id="t" />'],
    ['select', '<select id="t"></select>'],
    ['textarea', '<textarea id="t"></textarea>'],
    ['link', '<a id="t" href="#x">x</a>'],
    ['role=button', '<div id="t" role="button" tabindex="0">x</div>'],
    ['role=menuitem', '<li id="t" role="menuitem" tabindex="0">x</li>'],
    ['role=spinbutton', '<div data-game-board><div id="t" role="spinbutton" tabindex="0">20</div></div>'],
    ['focusable separator', '<div id="t" role="separator" aria-orientation="vertical" tabindex="0"></div>'],
    ['focusable log', '<div id="t" role="log" tabindex="0">line</div>'],
  ])('keeps Tab navigation on a %s', (_name, html) => {
    mount(html);
    expect(keepsTabNavigation(document.getElementById('t'))).toBe(true);
  });

  it.each([
    ['role=dialog', '<div role="dialog"><span id="t">x</span></div>'],
    ['role=alertdialog', '<div role="alertdialog"><span id="t">x</span></div>'],
    ['role=menu', '<ul role="menu"><li><span id="t">x</span></li></ul>'],
    ['aria-modal', '<div aria-modal="true"><span id="t">x</span></div>'],
  ])('keeps Tab navigation anywhere inside a %s', (_name, html) => {
    mount(html);
    expect(keepsTabNavigation(document.getElementById('t'))).toBe(true);
  });
});

describe('isModalOpen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is true only while an aria-modal element is in the document', () => {
    mount('<div role="dialog">non-modal panel</div>');
    expect(isModalOpen()).toBe(false);
    mount('<div role="dialog" aria-modal="true">modal</div>');
    expect(isModalOpen()).toBe(true);
  });
});

describe('isTabNavigationKey', () => {
  it('matches Tab and Shift+Tab, not Tab with Ctrl, Alt or Meta', () => {
    expect(isTabNavigationKey(new KeyboardEvent('keydown', { code: 'Tab' }))).toBe(true);
    expect(isTabNavigationKey(new KeyboardEvent('keydown', { code: 'Tab', shiftKey: true }))).toBe(true);
    expect(isTabNavigationKey(new KeyboardEvent('keydown', { code: 'Tab', ctrlKey: true }))).toBe(false);
    expect(isTabNavigationKey(new KeyboardEvent('keydown', { code: 'Tab', altKey: true }))).toBe(false);
    expect(isTabNavigationKey(new KeyboardEvent('keydown', { code: 'Tab', metaKey: true }))).toBe(false);
    expect(isTabNavigationKey(new KeyboardEvent('keydown', { code: 'Space' }))).toBe(false);
  });
});
