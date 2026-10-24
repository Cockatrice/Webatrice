import { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  isContextMenuKey,
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuItem,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  placeMenu,
  SUBMENU_CLOSE_DELAY,
  SUBMENU_OPEN_DELAY,
  TYPEAHEAD_TIMEOUT,
  useContextMenu,
} from './Menu';

function Example({ onPick = vi.fn() }: { onPick?: (item: string) => void }) {
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button">Before</button>
      <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Options
      </button>
      <button type="button">After</button>
      {open && (
        <Menu anchor={{ x: 10, y: 10 }} label="Options" onClose={() => setOpen(false)} triggerRef={trigger}>
          <MenuItem onSelect={() => onPick('alpha')}>Alpha</MenuItem>
          <MenuItem onSelect={() => onPick('off')} disabled disabledReason="Not now">Off</MenuItem>
          <MenuCheckboxItem checked={grid} onChange={setGrid}>Grid</MenuCheckboxItem>
          <MenuSeparator />
          <MenuSubmenu label="More">
            <MenuItem onSelect={() => onPick('beta')}>Beta</MenuItem>
            <MenuItem onSelect={() => onPick('gamma')}>Gamma</MenuItem>
          </MenuSubmenu>
          <MenuItem onSelect={() => onPick('delta')}>Delta</MenuItem>
        </Menu>
      )}
    </>
  );
}

async function openExample(onPick?: (item: string) => void) {
  const user = userEvent.setup();
  render(<Example onPick={onPick} />);
  screen.getByRole('button', { name: 'Options' }).focus();
  await user.keyboard('{Enter}');
  return user;
}

describe('Menu', () => {
  it('opens with focus on the first item and exposes menu semantics', async () => {
    await openExample();

    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('moves with the arrows, stopping on disabled items and wrapping at the ends', async () => {
    const user = await openExample();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Off' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Grid' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delta' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delta' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();
  });

  it('keeps a disabled item focusable, explains it, and does not run it', async () => {
    const onPick = vi.fn();
    const user = await openExample(onPick);
    const off = screen.getByRole('menuitem', { name: 'Off' });

    expect(off).toHaveAttribute('aria-disabled', 'true');
    expect(off).not.toBeDisabled();
    expect(off).toHaveAccessibleDescription('Not now');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
  });

  it('closes the whole menu after an item is chosen, from a submenu too', async () => {
    const onPick = vi.fn();
    const user = await openExample(onPick);

    screen.getByRole('menuitem', { name: 'More' }).focus();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onPick).toHaveBeenCalledWith('beta');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Options' })).toHaveFocus();
  });

  it('jumps to the next item starting with a typed letter', async () => {
    const user = await openExample();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);

    await user.keyboard('d');
    expect(screen.getByRole('menuitem', { name: 'Delta' })).toHaveFocus();
    now.mockReturnValue(1_000 + TYPEAHEAD_TIMEOUT + 1);
    await user.keyboard('m');
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveFocus();
    now.mockRestore();
  });

  it('lets onKeyDown claim a key before type-ahead', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: { key: string; preventDefault: () => void }) => {
      if (event.key === 'd') {
        event.preventDefault();
      }
    });
    render(
      <Menu anchor={{ x: 10, y: 10 }} label="Options" onClose={vi.fn()} onKeyDown={onKeyDown}>
        <MenuItem onSelect={vi.fn()}>Alpha</MenuItem>
        <MenuItem onSelect={vi.fn()}>Delta</MenuItem>
      </Menu>,
    );
    await user.keyboard('d');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delta' })).toHaveFocus();
  });

  it('toggles a checkbox item in place and reports its state', async () => {
    const user = await openExample();
    const grid = screen.getByRole('menuitemcheckbox', { name: 'Grid' });
    expect(grid).toHaveAttribute('aria-checked', 'false');

    grid.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menuitemcheckbox', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
  });

  it('opens a submenu with → and closes just that level with ← or Escape', async () => {
    const onPick = vi.fn();
    const user = await openExample(onPick);
    const more = screen.getByRole('menuitem', { name: 'More' });
    more.focus();

    await user.keyboard('{ArrowRight}');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Beta' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Gamma' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menu', { name: 'More' })).not.toBeInTheDocument();
    expect(more).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'More' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
    expect(more).toHaveFocus();

    await user.keyboard('{ArrowRight}{Enter}');
    expect(onPick).toHaveBeenCalledWith('beta');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = await openExample();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Options' })).toHaveFocus();
  });

  it('closes every level on Tab, also from inside a submenu', async () => {
    const user = await openExample();
    screen.getByRole('menuitem', { name: 'More' }).focus();
    await user.keyboard('{ArrowRight}');

    await user.tab();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('closes on a press outside, but not on its own trigger', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    render(<Example />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    act(() => {
      vi.advanceTimersToNextFrame();
    });

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'After' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

function ContextTarget() {
  const menu = useContextMenu();
  return (
    <>
      <a href="#target" {...menu.getTriggerProps()}>Target</a>
      {menu.anchor && (
        <Menu anchor={menu.anchor} label="Target actions" onClose={menu.close} triggerRef={menu.triggerRef}>
          <MenuItem onSelect={menu.close}>Inspect</MenuItem>
        </Menu>
      )}
    </>
  );
}

describe('useContextMenu', () => {
  it.each([
    ['Shift+F10', '{Shift>}{F10}{/Shift}'],
    ['the Menu key', '{ContextMenu}'],
  ])('opens from %s on the focused element and returns focus there', async (_, keys) => {
    const user = userEvent.setup();
    render(<ContextTarget />);
    const target = screen.getByRole('link', { name: 'Target' });
    target.focus();

    await user.keyboard(keys);

    expect(target).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Inspect' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(target).toHaveFocus();
  });

  it('opens at the pointer on right-click', () => {
    render(<ContextTarget />);

    fireEvent.contextMenu(screen.getByRole('link', { name: 'Target' }), { clientX: 40, clientY: 50 });

    expect(screen.getByRole('menu', { name: 'Target actions' })).toHaveStyle({ left: '40px', top: '50px' });
  });
});

function Rich({ onSelect = vi.fn() }: { onSelect?: (value: string) => void }) {
  const [open, setOpen] = useState(true);
  const [zone, setZone] = useState('hand');
  const [reveal, setReveal] = useState(false);
  return open ? (
    <Menu anchor={{ x: 10, y: 10 }} label="Card" onClose={() => setOpen(false)}>
      <MenuItem onSelect={() => onSelect('tap')} shortcut="Ctrl+T" keyShortcuts="Control+T">Tap</MenuItem>
      <MenuItem onSelect={() => onSelect('keep')} closeOnSelect={false}>Keep open</MenuItem>
      <MenuCheckboxItem checked={reveal} onChange={setReveal} shortcut="Ctrl+R" keyShortcuts="Control+R">Reveal</MenuCheckboxItem>
      <MenuGroup label="Move to">
        {['hand', 'graveyard', 'exile'].map((name) => (
          <MenuRadioItem key={name} checked={zone === name} onSelect={() => setZone(name)}>{name}</MenuRadioItem>
        ))}
      </MenuGroup>
      <MenuItem onSelect={() => onSelect('mulligan')}>Mulligan</MenuItem>
      <MenuItem onSelect={() => onSelect('move')}>Move top card</MenuItem>
      <MenuItem onSelect={() => onSelect('morph')}>Morph</MenuItem>
    </Menu>
  ) : null;
}

describe('Menu entries', () => {
  it('shows the formatted shortcut and exposes the ARIA one, on checkbox items too', () => {
    render(<Rich />);

    const tap = screen.getByRole('menuitem', { name: 'Tap' });
    expect(tap).toHaveAttribute('aria-keyshortcuts', 'Control+T');
    expect(tap).toHaveTextContent('Ctrl+T');
    const reveal = screen.getByRole('menuitemcheckbox', { name: 'Reveal' });
    expect(reveal).toHaveAttribute('aria-keyshortcuts', 'Control+R');
    expect(reveal).toHaveTextContent('Ctrl+R');
  });

  it('checks one radio item of a group at a time and stays open', async () => {
    const user = userEvent.setup();
    render(<Rich />);
    expect(screen.getByRole('group', { name: 'Move to' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'hand' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemradio', { name: 'exile' }));

    expect(screen.getByRole('menuitemradio', { name: 'exile' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'hand' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menu', { name: 'Card' })).toBeInTheDocument();
  });

  it('leaves the menu open after an item with closeOnSelect={false}', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu anchor={{ x: 0, y: 0 }} label="Card" onClose={onClose}>
        <MenuItem onSelect={vi.fn()} closeOnSelect={false}>Keep open</MenuItem>
        <MenuItem onSelect={vi.fn()}>Close</MenuItem>
      </Menu>,
    );

    await user.click(screen.getByRole('menuitem', { name: 'Keep open' }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('menuitem', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('builds a type-ahead prefix from letters typed in quick succession', () => {
    vi.useFakeTimers();
    try {
      render(<Rich />);
      const menu = screen.getByRole('menu', { name: 'Card' });

      fireEvent.keyDown(menu, { key: 'm' });
      expect(screen.getByRole('menuitem', { name: 'Mulligan' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: 'o' });
      expect(screen.getByRole('menuitem', { name: 'Move top card' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: 'r' });
      expect(screen.getByRole('menuitem', { name: 'Morph' })).toHaveFocus();

      vi.advanceTimersByTime(TYPEAHEAD_TIMEOUT + 1);
      fireEvent.keyDown(document.activeElement!, { key: 'm' });
      expect(screen.getByRole('menuitem', { name: 'Mulligan' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: 'm' });
      expect(screen.getByRole('menuitem', { name: 'Move top card' })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Menu type-ahead', () => {
  function Moves({ onSelect }: { onSelect: (value: string) => void }) {
    return (
      <Menu anchor={{ x: 10, y: 10 }} label="Card" onClose={vi.fn()}>
        <MenuItem onSelect={() => onSelect('mulligan')}>Mulligan</MenuItem>
        <MenuItem onSelect={() => onSelect('hand')}>Move to hand</MenuItem>
        <MenuItem onSelect={() => onSelect('card')}>Move card</MenuItem>
      </Menu>
    );
  }

  it('reads a Space typed during a search as part of it, without running the focused item', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Moves onSelect={onSelect} />);

    await user.keyboard('move c');

    expect(screen.getByRole('menuitem', { name: 'Move card' })).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still runs the focused item on Space outside a search', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Moves onSelect={onSelect} />);

    await user.keyboard(' ');

    expect(onSelect).toHaveBeenCalledWith('mulligan');
  });
});

describe('Menu type-ahead reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a new search after the arrows move focus', () => {
    render(<Rich />);
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Card' }), { key: 'm' });
    expect(screen.getByRole('menuitem', { name: 'Mulligan' })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'e' });

    expect(screen.getByRole('menuitemradio', { name: 'exile' })).toHaveFocus();
  });

  it('starts a new search after the pointer moves focus', () => {
    render(<Rich />);
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Card' }), { key: 'm' });

    fireEvent.mouseOver(screen.getByRole('menuitem', { name: 'Tap' }));
    fireEvent.keyDown(document.activeElement!, { key: 'e' });

    expect(screen.getByRole('menuitemradio', { name: 'exile' })).toHaveFocus();
  });
});

describe('MenuSubmenu pointer behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderNested() {
    render(
      <Menu anchor={{ x: 0, y: 0 }} label="Card" onClose={vi.fn()}>
        <MenuSubmenu label="Counters">
          <MenuItem onSelect={vi.fn()}>Add counter</MenuItem>
        </MenuSubmenu>
        <MenuItem onSelect={vi.fn()}>Tap</MenuItem>
      </Menu>,
    );
    return {
      entry: screen.getByRole('menuitem', { name: 'Counters' }),
      tap: screen.getByRole('menuitem', { name: 'Tap' }),
    };
  }

  it('opens after a hover delay without taking focus; → then moves into it', () => {
    const { entry } = renderNested();

    fireEvent.mouseOver(entry);
    fireEvent.mouseEnter(entry);
    expect(entry).toHaveFocus();
    expect(screen.queryByRole('menu', { name: 'Counters' })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(SUBMENU_OPEN_DELAY);
    });

    expect(screen.getByRole('menu', { name: 'Counters' })).toBeInTheDocument();
    expect(entry).toHaveFocus();
    fireEvent.keyDown(entry, { key: 'ArrowRight' });
    expect(screen.getByRole('menuitem', { name: 'Add counter' })).toHaveFocus();
  });

  function hoverOpen(entry: HTMLElement) {
    fireEvent.mouseOver(entry);
    fireEvent.mouseEnter(entry);
    act(() => {
      vi.advanceTimersByTime(SUBMENU_OPEN_DELAY);
    });
    expect(screen.getByRole('menu', { name: 'Counters' })).toBeInTheDocument();
  }

  it.each([['ArrowDown'], ['ArrowUp'], ['End']])('closes a hover-opened submenu when %s moves away from its entry', (key) => {
    const { entry, tap } = renderNested();
    hoverOpen(entry);

    fireEvent.keyDown(entry, { key });

    expect(tap).toHaveFocus();
    expect(screen.queryByRole('menu', { name: 'Counters' })).not.toBeInTheDocument();
    expect(entry).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a hover-opened submenu open when Home lands on its own entry', () => {
    const { entry } = renderNested();
    hoverOpen(entry);

    fireEvent.keyDown(entry, { key: 'Home' });

    expect(entry).toHaveFocus();
    expect(screen.getByRole('menu', { name: 'Counters' })).toBeInTheDocument();
  });

  it('does not open when the pointer only passes over the entry', () => {
    const { entry } = renderNested();

    fireEvent.mouseEnter(entry);
    fireEvent.mouseLeave(entry);
    act(() => {
      vi.advanceTimersByTime(SUBMENU_OPEN_DELAY);
    });

    expect(screen.queryByRole('menu', { name: 'Counters' })).not.toBeInTheDocument();
  });

  it('stays open while the pointer crosses a sibling into it, and closes if it rests on the sibling', () => {
    const { entry, tap } = renderNested();
    fireEvent.click(entry);
    expect(screen.getByRole('menuitem', { name: 'Add counter' })).toHaveFocus();

    fireEvent.mouseOver(tap);
    expect(tap).toHaveFocus();
    fireEvent.mouseOver(screen.getByRole('menuitem', { name: 'Add counter' }));
    act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_DELAY);
    });
    expect(screen.getByRole('menu', { name: 'Counters' })).toBeInTheDocument();

    fireEvent.mouseOver(tap);
    act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_DELAY);
    });
    expect(screen.queryByRole('menu', { name: 'Counters' })).not.toBeInTheDocument();
  });

  it('opens to the left of its entry when the right side has no room', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function boundingRect(this: HTMLElement) {
      const rect = this.getAttribute('role') === 'menu'
        ? { left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }
        : { left: 900, top: 100, right: 1000, bottom: 124, width: 100, height: 24 };
      return { ...rect, x: rect.left, y: rect.top, toJSON: () => rect } as DOMRect;
    });
    const { entry } = renderNested();

    fireEvent.click(entry);

    expect(screen.getByRole('menu', { name: 'Counters' })).toHaveStyle({ left: '700px', top: '96px' });
    vi.restoreAllMocks();
  });
});

describe('Menu placement', () => {
  function layout(control: { left: number; top: number; right: number; bottom: number }) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function boundingRect(this: HTMLElement) {
      const cap = parseFloat(this.style.maxHeight);
      const rect = this.getAttribute('role') === 'menu'
        ? { left: 0, top: 0, right: 200, bottom: Math.min(300, Number.isNaN(cap) ? Infinity : cap) }
        : control;
      const box = { ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top };
      return { ...box, x: rect.left, y: rect.top, toJSON: () => box } as DOMRect;
    });
  }
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('measures its full height, so it flips above a control near the bottom of the screen', async () => {
    layout({ left: 100, top: 700, right: 180, bottom: 720 });
    const user = userEvent.setup();
    render(<ContextTarget />);
    screen.getByRole('link', { name: 'Target' }).focus();

    await user.keyboard('{Shift>}{F10}{/Shift}');

    expect(screen.getByRole('menu', { name: 'Target actions' })).toHaveStyle({ left: '100px', top: '398px', maxHeight: '362px' });
  });

  it('measures its full height, so a menu opened at a point near the bottom opens above it', () => {
    layout({ left: 0, top: 0, right: 0, bottom: 0 });

    render(
      <Menu anchor={{ x: 100, y: 700 }} label="Card" onClose={vi.fn()}>
        <MenuItem onSelect={vi.fn()}>Tap</MenuItem>
      </Menu>,
    );

    expect(screen.getByRole('menu', { name: 'Card' })).toHaveStyle({ left: '100px', top: '400px' });
  });
});

describe('placeMenu', () => {
  const viewport = { width: 1024, height: 768 };
  const size = { width: 200, height: 300 };

  it('drops below a control, and flips above it near the bottom of the screen', () => {
    expect(placeMenu({ rect: { left: 100, top: 100, right: 180, bottom: 120 }, placement: 'below' }, size, viewport))
      .toMatchObject({ left: 100, top: 122 });
    expect(placeMenu({ rect: { left: 100, top: 700, right: 180, bottom: 720 }, placement: 'below' }, size, viewport))
      .toMatchObject({ left: 100, top: 398 });
  });

  it('opens a submenu to the right, flipping left at the right edge and up at the bottom', () => {
    expect(placeMenu({ rect: { left: 100, top: 100, right: 300, bottom: 124 }, placement: 'right' }, size, viewport))
      .toMatchObject({ left: 300, top: 96 });
    expect(placeMenu({ rect: { left: 824, top: 600, right: 1024, bottom: 624 }, placement: 'right' }, size, viewport))
      .toMatchObject({ left: 624, top: 328 });
  });

  it('clamps when neither side has room', () => {
    expect(placeMenu({ rect: { left: 0, top: 300, right: 1024, bottom: 324 }, placement: 'right' }, size, viewport))
      .toMatchObject({ left: 816, top: 296 });
    expect(placeMenu({ x: 500, y: 300 }, { width: 200, height: 760 }, viewport)).toMatchObject({ left: 500, top: 8 });
  });

  it('flips a point anchor like a zero-size control, to the other side of the point', () => {
    expect(placeMenu({ x: 100, y: 100 }, size, viewport)).toMatchObject({ left: 100, top: 100 });
    expect(placeMenu({ x: 1000, y: 700 }, size, viewport)).toMatchObject({ left: 800, top: 400 });
    expect(placeMenu({ x: 150, y: 100, align: 'end' }, size, viewport)).toMatchObject({ left: 150, top: 100 });
    expect(placeMenu({ x: 1000, y: 100, align: 'end' }, size, viewport)).toMatchObject({ left: 800, top: 100 });
  });

  it('lines an end-aligned menu up with the right edge of its control', () => {
    expect(placeMenu({ rect: { left: 900, top: 10, right: 1000, bottom: 40 }, placement: 'below', align: 'end' }, size, viewport))
      .toMatchObject({ left: 800, top: 42 });
  });
});

describe('isContextMenuKey', () => {
  const key = (init: Partial<KeyboardEvent>) => ({ shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...init }) as never;

  it('accepts Shift+F10 and the Menu key, but not Shift+F10 with another modifier', () => {
    expect(isContextMenuKey(key({ key: 'F10', shiftKey: true }))).toBe(true);
    expect(isContextMenuKey(key({ key: 'ContextMenu' }))).toBe(true);
    expect(isContextMenuKey(key({ key: 'F10' }))).toBe(false);
    expect(isContextMenuKey(key({ key: 'F10', shiftKey: true, ctrlKey: true }))).toBe(false);
    expect(isContextMenuKey(key({ key: 'F10', shiftKey: true, altKey: true }))).toBe(false);
    expect(isContextMenuKey(key({ key: 'F10', shiftKey: true, metaKey: true }))).toBe(false);
  });
});

it('restores a removed menu opener to its landmark', async () => {
  const user = userEvent.setup();
  function Page() {
    const [shown, setShown] = useState(true);
    const menu = useContextMenu();
    return <main aria-label="Users">
      {shown && <button type="button" {...menu.getTriggerProps()}>User</button>}
      {menu.anchor && <Menu anchor={menu.anchor} triggerRef={menu.triggerRef} label="User" onClose={menu.close}>
        <MenuItem closeOnSelect={false} onSelect={() => setShown(false)}>Remove</MenuItem>
      </Menu>}
    </main>;
  }
  render(<Page />);
  screen.getByRole('button', { name: 'User' }).focus();
  await user.keyboard('{ContextMenu}{Enter}{Escape}');
  expect(screen.getByRole('main', { name: 'Users' })).toHaveFocus();
});

it('does not steal focus from another menu on cleanup', () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  const first = render(
    <Menu label="First" anchor={{ x: 0, y: 0 }} onClose={vi.fn()} triggerRef={{ current: opener }}>
      <MenuItem onSelect={vi.fn()}>One</MenuItem>
    </Menu>,
  );
  render(<Menu label="Second" anchor={{ x: 0, y: 0 }} onClose={vi.fn()}><MenuItem onSelect={vi.fn()}>Two</MenuItem></Menu>);
  const focus = vi.spyOn(opener, 'focus');
  first.unmount();
  expect(focus).not.toHaveBeenCalled();
  expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
  opener.remove();
});

it('closes on Shift+Tab and moves to the preceding tab stop', async () => {
  const user = await openExample();
  await user.tab({ shift: true });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
});
