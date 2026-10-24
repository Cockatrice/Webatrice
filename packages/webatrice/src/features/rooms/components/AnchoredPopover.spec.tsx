import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { AnchoredPopover, placePopover } from './AnchoredPopover';

const viewport = { width: 1000, height: 600 };

describe('placePopover', () => {
  it('opens below the anchor and caps its height at the viewport bottom', () => {
    expect(placePopover({ top: 100, bottom: 130, left: 50, right: 150 }, { width: 300, height: 900 }, viewport, 'start'))
      .toEqual({ top: 138, left: 50, maxHeight: 454 });
  });

  it('flips above when there is more room above a low anchor', () => {
    expect(placePopover({ top: 500, bottom: 530, left: 50, right: 150 }, { width: 300, height: 300 }, viewport, 'start'))
      .toEqual({ top: 192, left: 50, maxHeight: 484 });
  });

  it('keeps an end-aligned panel inside the left and right edges', () => {
    expect(placePopover({ top: 10, bottom: 40, left: 0, right: 100 }, { width: 300, height: 100 }, viewport, 'end').left).toBe(8);
    expect(placePopover({ top: 10, bottom: 40, left: 900, right: 1100 }, { width: 300, height: 100 }, viewport, 'start').left)
      .toBe(692);
  });
});

function Harness() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Elsewhere</button>
      {open && (
        <AnchoredPopover anchor={trigger} label="Panel" onClose={() => setOpen(false)}>
          <input aria-label="Field" data-autofocus />
          <button type="button" onClick={() => setOpen(false)}>Done</button>
        </AnchoredPopover>
      )}
    </>
  );
}

describe('AnchoredPopover focus', () => {
  it('focuses the panel field, and Escape closes it and returns focus to the trigger', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByLabelText('Field')).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Panel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('returns focus to the trigger when a button inside closes it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    screen.getByRole('button', { name: 'Done' }).focus();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('closes when focus leaves it, without pulling focus back', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

    fireEvent.focusOut(screen.getByLabelText('Field'), { relatedTarget: elsewhere });

    expect(screen.queryByRole('dialog', { name: 'Panel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveFocus();
  });
});
