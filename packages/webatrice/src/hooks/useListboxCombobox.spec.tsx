import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { useListboxCombobox, type ListboxComboboxOptions } from './useListboxCombobox';

const OPTIONS = ['Alpha', 'Beta', 'Gamma'];

type Overrides = Partial<Omit<ListboxComboboxOptions, 'highlight' | 'onHighlightChange'>> & { initialHighlight?: number };

function Harness({ initialHighlight = 0, open = true, ...options }: Overrides) {
  const [highlight, setHighlight] = useState(initialHighlight);
  const { listboxId, inputProps, getOptionProps } = useListboxCombobox({
    count: OPTIONS.length,
    open,
    highlight,
    onHighlightChange: setHighlight,
    onAccept: vi.fn(),
    onClose: vi.fn(),
    ...options,
  });
  return (
    <div onKeyDown={pageKeyDown}>
      <input aria-label="Search" {...inputProps} />
      <ul id={listboxId} role="listbox" hidden={!inputProps['aria-expanded']}>
        {OPTIONS.map((name, index) => <li key={name} {...getOptionProps(index)}>{name}</li>)}
      </ul>
    </div>
  );
}

const pageKeyDown = vi.fn();
const input = () => screen.getByRole('combobox', { name: 'Search' });
const press = (key: string, init: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(input(), { key, ...init });

beforeEach(() => {
  pageKeyDown.mockClear();
});

describe('useListboxCombobox', () => {
  it('is an expanded combobox that points at its listbox and highlighted option', () => {
    render(<Harness initialHighlight={1} />);
    const options = screen.getAllByRole('option');
    expect(input()).toHaveAttribute('aria-autocomplete', 'list');
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(input()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(input()).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('stays collapsed with no options, still pointing at the hidden listbox', () => {
    render(<Harness count={0} />);
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(document.getElementById(input().getAttribute('aria-controls')!)).toHaveAttribute('hidden');
  });

  it('moves the highlight with the arrows, wrapping at both ends', () => {
    render(<Harness initialHighlight={2} />);
    const active = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '')?.textContent;
    press('ArrowDown');
    expect(active()).toBe('Alpha');
    press('ArrowUp');
    expect(active()).toBe('Gamma');
    press('ArrowUp');
    expect(active()).toBe('Beta');
  });

  it('takes the highlighted option with Enter or a click, keeping focus in the input', () => {
    const onAccept = vi.fn();
    render(<Harness initialHighlight={1} onAccept={onAccept} />);
    press('Enter');
    expect(onAccept).toHaveBeenLastCalledWith(1);
    const gamma = screen.getByRole('option', { name: 'Gamma' });
    input().focus();
    expect(fireEvent.mouseDown(gamma)).toBe(false);
    fireEvent.click(gamma);
    expect(onAccept).toHaveBeenLastCalledWith(2);
    expect(input()).toHaveFocus();
  });

  it('runs the Enter fallback while the list is open with nothing highlighted', () => {
    const onAccept = vi.fn();
    const onEnterWithoutOption = vi.fn();
    render(<Harness initialHighlight={-1} onAccept={onAccept} onEnterWithoutOption={onEnterWithoutOption} />);
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    press('Enter');
    expect(onEnterWithoutOption).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('highlights a pointed-at option only when asked', () => {
    const { unmount } = render(<Harness />);
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Gamma' }));
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    unmount();

    render(<Harness highlightOnHover />);
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Gamma' }));
    expect(screen.getByRole('option', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
  });

  it('scrolls the highlighted option into view as it moves', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness />);
      press('ArrowDown');
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole('option', { name: 'Beta' }));
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('leaves Enter and the arrows alone while closed, unless told what they do', () => {
    const onAccept = vi.fn();
    const { unmount } = render(<Harness open={false} onAccept={onAccept} />);
    expect(press('Enter')).toBe(true);
    expect(press('ArrowDown')).toBe(true);
    expect(onAccept).not.toHaveBeenCalled();
    unmount();

    const onEnterWithoutOption = vi.fn();
    render(<Harness open={false} initialHighlight={-1} onEnterWithoutOption={onEnterWithoutOption} />);
    expect(press('Enter')).toBe(false);
    expect(onEnterWithoutOption).toHaveBeenCalledTimes(1);
  });

  it('opens a closed list with ↓ on the highlighted option, or the first, and with ↑ on the last', () => {
    function Opening({ initialHighlight }: { initialHighlight: number }) {
      const [open, setOpen] = useState(false);
      return <Harness open={open} initialHighlight={initialHighlight} onOpen={() => setOpen(true)} />;
    }
    const active = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '')?.textContent;
    const { unmount } = render(<Opening initialHighlight={-1} />);
    expect(press('ArrowDown')).toBe(false);
    expect(active()).toBe('Alpha');
    unmount();

    const second = render(<Opening initialHighlight={1} />);
    press('ArrowDown');
    expect(active()).toBe('Beta');
    second.unmount();

    render(<Opening initialHighlight={0} />);
    expect(press('ArrowUp')).toBe(false);
    expect(active()).toBe('Gamma');
  });

  it('closes with the first Escape without it reaching the page, and leaves the next to the page', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness onClose={onClose} />);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pageKeyDown).not.toHaveBeenCalled();

    rerender(<Harness open={false} onClose={onClose} />);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pageKeyDown).toHaveBeenCalledTimes(1);
  });

  it('runs the second step on the next Escape when it has one, keeping it from the page', () => {
    const onClose = vi.fn();
    const onEscapeClosed = vi.fn();
    render(<Harness open={false} onClose={onClose} onEscapeClosed={onEscapeClosed} />);
    expect(press('Escape')).toBe(false);
    expect(onEscapeClosed).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(pageKeyDown).not.toHaveBeenCalled();
  });

  it('closes an expanded list on the first Escape even with no status panel up', () => {
    const onClose = vi.fn();
    render(<Harness popupShown={false} onClose={onClose} onEscapeClosed={vi.fn()} />);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes a status popup in the listbox\'s place on the first Escape', () => {
    const onClose = vi.fn();
    const onEscapeClosed = vi.fn();
    render(<Harness count={0} popupShown onClose={onClose} onEscapeClosed={onEscapeClosed} />);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEscapeClosed).not.toHaveBeenCalled();
    expect(pageKeyDown).not.toHaveBeenCalled();
  });

  it('takes the option on Tab only when asked, and lets focus move on', () => {
    const onAccept = vi.fn();
    const { unmount } = render(<Harness onAccept={onAccept} />);
    expect(press('Tab')).toBe(true);
    expect(onAccept).not.toHaveBeenCalled();
    unmount();

    render(<Harness onAccept={onAccept} acceptOnTab />);
    expect(press('Tab', { shiftKey: true })).toBe(true);
    expect(onAccept).not.toHaveBeenCalled();
    expect(press('Tab')).toBe(true);
    expect(onAccept).toHaveBeenCalledWith(0);
  });

  it('leaves keys that confirm an IME composition to the composition', () => {
    const onAccept = vi.fn();
    render(<Harness onAccept={onAccept} />);
    expect(press('Enter', { isComposing: true })).toBe(true);
    expect(onAccept).not.toHaveBeenCalled();
  });
});
