
import type { ReactNode } from 'react';
import { fireEvent } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import { ShortcutProvider } from './ShortcutProvider';
import { useShortcut } from './useShortcut';
import { ShortcutScope } from './types';

vi.mock('../../hooks/useSettings');

const handlers = {
  nextPhase: vi.fn(),
  nextPhaseAction: vi.fn(),
  closeRecentView: vi.fn(),
  chatFocus: vi.fn(),
};

function Harness({ children }: { children?: ReactNode }) {
  useShortcut('game.nextPhase', handlers.nextPhase, { scope: ShortcutScope.GAME });
  useShortcut('game.nextPhaseAction', handlers.nextPhaseAction, { scope: ShortcutScope.GAME });
  useShortcut('game.closeRecentView', handlers.closeRecentView, { scope: ShortcutScope.GAME });
  useShortcut('chat.focus', handlers.chatFocus, { scope: ShortcutScope.GLOBAL });
  return <>{children}</>;
}

function renderGame(children?: ReactNode) {
  return renderWithProviders(
    <ShortcutProvider>
      <Harness>{children}</Harness>
    </ShortcutProvider>,
    { route: '/game/1' },
  );
}

function press(target: Element, init: KeyboardEventInit) {
  return fireEvent.keyDown(target, init);
}

describe('ShortcutProvider focus guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires Tab and Shift+Tab on the page body as desktop does', () => {
    renderGame();

    const tab = press(document.body, { code: 'Tab', key: 'Tab' });
    press(document.body, { code: 'Tab', key: 'Tab', shiftKey: true });

    expect(handlers.nextPhase).toHaveBeenCalledTimes(1);
    expect(handlers.nextPhaseAction).toHaveBeenCalledTimes(1);
    expect(tab).toBe(false);
  });

  it('fires Tab and Shift+Tab on a focused board card with a button role', () => {
    const { getByTestId } = renderGame(
      <div data-game-board>
        <div data-testid="t" data-card-id="7" role="button" aria-roledescription="draggable" tabIndex={0}>
          Bear
        </div>
      </div>,
    );
    const card = getByTestId('t');
    card.focus();
    expect(card).toHaveFocus();

    const tab = press(card, { code: 'Tab', key: 'Tab' });
    const shiftTab = press(card, { code: 'Tab', key: 'Tab', shiftKey: true });

    expect(handlers.nextPhase).toHaveBeenCalledTimes(1);
    expect(handlers.nextPhaseAction).toHaveBeenCalledTimes(1);
    expect(tab).toBe(false);
    expect(shiftTab).toBe(false);
  });

  it.each([
    ['a button', <button key="b" data-testid="t">Go</button>],
    ['a menu', <ul key="m" role="menu"><li data-testid="t" role="menuitem" tabIndex={0}>Item</li></ul>],
    ['a non-modal dialog', <div key="d" role="dialog"><span data-testid="t">Panel</span></div>],
    [
      'a card inside a dialog',
      <div key="c" role="dialog"><div data-testid="t" data-card-id="7" role="button" tabIndex={0}>Bear</div></div>,
    ],
    [
      'a card inside a menu on the board',
      <div key="cm" data-game-board>
        <div role="menu"><div data-testid="t" data-card-id="7" role="button" tabIndex={0}>Bear</div></div>
      </div>,
    ],
  ])('leaves Tab and Shift+Tab to the browser on %s', (_name, node) => {
    const { getByTestId } = renderGame(node);
    const target = getByTestId('t');
    if (target.hasAttribute('data-card-id')) {
      target.focus();
      expect(target).toHaveFocus();
    }

    const tab = press(target, { code: 'Tab', key: 'Tab' });
    const shiftTab = press(target, { code: 'Tab', key: 'Tab', shiftKey: true });

    expect(handlers.nextPhase).not.toHaveBeenCalled();
    expect(handlers.nextPhaseAction).not.toHaveBeenCalled();
    expect(tab).toBe(true);
    expect(shiftTab).toBe(true);
  });

  it('fires Ctrl+Space for next phase from a button, since only Tab moves focus', () => {
    const { getByTestId } = renderGame(<button data-testid="t">Go</button>);

    press(getByTestId('t'), { code: 'Space', key: ' ', ctrlKey: true });

    expect(handlers.nextPhase).toHaveBeenCalledTimes(1);
  });

  it('runs only global shortcuts while a modal is open, and leaves Escape to the modal', () => {
    renderGame(<div role="dialog" aria-modal="true">Modal</div>);

    press(document.body, { code: 'Tab', key: 'Tab' });
    press(document.body, { code: 'Space', key: ' ', ctrlKey: true });
    const escape = press(document.body, { code: 'Escape', key: 'Escape' });

    expect(handlers.nextPhase).not.toHaveBeenCalled();
    expect(handlers.closeRecentView).not.toHaveBeenCalled();
    expect(escape).toBe(true);
  });

  it('leaves a key the focused control already handled alone', () => {
    const { getByRole } = renderGame(
      <button type="button" onKeyDown={(event) => event.preventDefault()}>Handles its own keys</button>,
    );
    press(getByRole('button'), { code: 'Escape', key: 'Escape' });
    expect(handlers.closeRecentView).not.toHaveBeenCalled();

    press(document.body, { code: 'Escape', key: 'Escape' });
    expect(handlers.closeRecentView).toHaveBeenCalledTimes(1);
  });

  it('still fires global shortcuts while a modal is open', () => {
    renderGame(<div role="dialog" aria-modal="true">Modal</div>);

    press(document.body, { code: 'Enter', key: 'Enter', shiftKey: true });

    expect(handlers.chatFocus).toHaveBeenCalledTimes(1);
  });

  it('closes the latest zone view on Escape once no modal is open', () => {
    renderGame();

    press(document.body, { code: 'Escape', key: 'Escape' });

    expect(handlers.closeRecentView).toHaveBeenCalledTimes(1);
  });
});
