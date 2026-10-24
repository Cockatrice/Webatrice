import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../../__test-utils__';

import { PileViewToggle, ZoneViewSortControls } from './ZoneViewControls';

describe('ZoneViewSortControls', () => {
  it('offers desktop\'s groupings and sort keys and reports a pick', () => {
    const onGroupByChange = vi.fn();
    const onSortByChange = vi.fn();
    renderWithProviders(
      <ZoneViewSortControls
        groupBy="type"
        sortBy="name"
        onGroupByChange={onGroupByChange}
        onSortByChange={onSortByChange}
      />,
    );
    const group = screen.getByTitle('Group by') as HTMLSelectElement;
    const sort = screen.getByTitle('Sort by') as HTMLSelectElement;
    expect([...group.options].map((o) => o.value)).toEqual(['none', 'type', 'cmc', 'color']);
    expect([...sort.options].map((o) => o.value)).toEqual(['none', 'name', 'cmc', 'type', 'color', 'set', 'pt']);
    fireEvent.change(group, { target: { value: 'cmc' } });
    fireEvent.change(sort, { target: { value: 'set' } });
    expect(onGroupByChange).toHaveBeenCalledWith('cmc');
    expect(onSortByChange).toHaveBeenCalledWith('set');
  });
});

describe('PileViewToggle', () => {
  it('is disabled and unticked while ungrouped', () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(<PileViewToggle groupBy="none" pileView onChange={onChange} />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(<PileViewToggle groupBy="type" pileView onChange={onChange} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
