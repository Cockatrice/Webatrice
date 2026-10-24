import { fireEvent, render, screen } from '@testing-library/react';

import { PaneResizer, type PaneResizerProps } from './PaneResizer';

function renderResizer(overrides: Partial<PaneResizerProps> = {}) {
  const props: PaneResizerProps = {
    label: 'Resize Find cards',
    side: 'left',
    width: 300,
    range: { min: 260, max: 500 },
    onResize: vi.fn(),
    onResizeBy: vi.fn(),
    onReset: vi.fn(),
    onCollapse: vi.fn(),
    ...overrides,
  };
  render(<PaneResizer {...props} />);
  return { props, handle: screen.getByRole('separator', { name: props.label }) };
}

describe('PaneResizer', () => {
  it('is a focusable vertical separator that reports the pane width', () => {
    const { handle } = renderResizer();
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuenow', '300');
    expect(handle).toHaveAttribute('aria-valuemin', '260');
    expect(handle).toHaveAttribute('aria-valuemax', '500');
  });

  it('moves with the arrow keys: right grows a left pane and shrinks a right pane', () => {
    const left = renderResizer();
    fireEvent.keyDown(left.handle, { key: 'ArrowRight' });
    fireEvent.keyDown(left.handle, { key: 'ArrowLeft', shiftKey: true });
    expect(left.props.onResizeBy).toHaveBeenNthCalledWith(1, 16);
    expect(left.props.onResizeBy).toHaveBeenNthCalledWith(2, -64);

    const right = renderResizer({ label: 'Resize inspector', side: 'right' });
    fireEvent.keyDown(right.handle, { key: 'ArrowRight' });
    expect(right.props.onResizeBy).toHaveBeenCalledWith(-16);
  });

  it('jumps to the limits with Home and End, and collapses the pane with Enter', () => {
    const { props, handle } = renderResizer();
    fireEvent.keyDown(handle, { key: 'Home' });
    fireEvent.keyDown(handle, { key: 'End' });
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(props.onResize).toHaveBeenNthCalledWith(1, 260);
    expect(props.onResize).toHaveBeenNthCalledWith(2, 500);
    expect(props.onCollapse).toHaveBeenCalled();
  });

  it('leaves modified arrow keys alone', () => {
    const { props, handle } = renderResizer();
    fireEvent.keyDown(handle, { key: 'ArrowRight', ctrlKey: true });
    expect(props.onResizeBy).not.toHaveBeenCalled();
  });

  it('resets the width on double-click', () => {
    const { props, handle } = renderResizer();
    fireEvent.doubleClick(handle);
    expect(props.onReset).toHaveBeenCalled();
  });

  it('follows the pointer while dragging', () => {
    const right = renderResizer({ side: 'right', width: 380 });
    fireEvent.pointerDown(right.handle, { button: 0, clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(right.handle, { clientX: 940, pointerId: 1 });
    fireEvent.pointerUp(right.handle, { clientX: 940, pointerId: 1 });
    fireEvent.pointerMove(right.handle, { clientX: 900, pointerId: 1 });
    expect(right.props.onResize).toHaveBeenCalledTimes(1);
    expect(right.props.onResize).toHaveBeenCalledWith(440);
  });
});
