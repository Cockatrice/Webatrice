import { act, render, screen } from '@testing-library/react';

import { getSettings, settingsStore } from '../../../../hooks/useSettings';
import type { Preferences } from '../../../../types';
import { DragSelectionCount, dragCountPlacement } from './SelectionCount';

const setPreferences = async (patch: Partial<Preferences>) => {
  const settings = await getSettings();
  await act(async () => {
    settingsStore.setValue(Object.assign(settings, patch));
  });
};

afterEach(() => {
  settingsStore.reset();
});

describe('dragCountPlacement', () => {
  it('puts the count in the corner the pointer drags, inside the band', () => {
    expect(dragCountPlacement({ x1: 0, y1: 0, x2: 100, y2: 100 }, 3)).toEqual({ right: 4, bottom: 4 });
    expect(dragCountPlacement({ x1: 100, y1: 100, x2: 0, y2: 0 }, 3)).toEqual({ left: 4, top: 4 });
    expect(dragCountPlacement({ x1: 100, y1: 0, x2: 0, y2: 100 }, 3)).toEqual({ left: 4, bottom: 4 });
  });

  it('hides the count in a band too small to hold it, as desktop does', () => {
    expect(dragCountPlacement({ x1: 0, y1: 0, x2: 10, y2: 100 }, 3)).toBeNull();
    expect(dragCountPlacement({ x1: 0, y1: 0, x2: 100, y2: 20 }, 3)).toBeNull();
    expect(dragCountPlacement({ x1: 0, y1: 0, x2: 25, y2: 100 }, 3)).not.toBeNull();
    expect(dragCountPlacement({ x1: 0, y1: 0, x2: 25, y2: 100 }, 300)).toBeNull();
  });
});

describe('DragSelectionCount', () => {
  const band = { x1: 0, y1: 0, x2: 200, y2: 200 };

  it('shows how many cards the band selects', () => {
    render(<DragSelectionCount band={band} count={4} />);
    expect(screen.getByTestId('drag-selection-count')).toHaveTextContent('4');
  });

  it('shows nothing while the band selects nothing, or with the option off', async () => {
    const { rerender } = render(<DragSelectionCount band={band} count={0} />);
    expect(screen.queryByTestId('drag-selection-count')).not.toBeInTheDocument();

    await setPreferences({ showDragSelectionCount: false });
    rerender(<DragSelectionCount band={band} count={4} />);
    expect(screen.queryByTestId('drag-selection-count')).not.toBeInTheDocument();
  });
});
