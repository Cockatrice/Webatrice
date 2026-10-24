import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';
import { allActionIds } from '../defaults';
import ShortcutsRow from './ShortcutsRow';

const [ACTION, OTHER] = allActionIds;

describe('ShortcutsRow', () => {
  it('names Edit and Reset after the row action, so each row is distinguishable', () => {
    renderWithProviders(<ShortcutsRow actionId={ACTION} conflicts={[]} onEdit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'ShortcutsTab.editAction' })).toHaveAttribute('title', 'ShortcutsTab.edit');
    expect(screen.getByRole('button', { name: 'ShortcutsTab.resetNamedAction' })).toBeDisabled();
  });

  it('spells out a conflict instead of leaving it to the icon tooltip', () => {
    renderWithProviders(<ShortcutsRow actionId={ACTION} conflicts={[OTHER]} onEdit={vi.fn()} />);

    expect(screen.getByText('ShortcutsTab.conflictWarning')).toHaveClass('sr-only');
  });
});
