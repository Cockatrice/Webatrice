import type { ReactNode } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useManageSets: vi.fn() }));

vi.mock('./useManageSets', () => ({ useManageSets: hoisted.useManageSets }));
vi.mock('@app/components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/components')>()),
  VirtualRows: <T, >({ items, renderRow }: { items: T[]; renderRow: (item: T, i: number) => ReactNode }) => (
    <div role="rowgroup">{items.map((item, i) => <div key={i}>{renderRow(item, i)}</div>)}</div>
  ),
}));

import ManageSets from './ManageSets';
import type { SetRow } from './manageSetsModel';

const row = (code: string, enabled = true): SetRow => ({
  code, longName: `${code} long`, setType: 'expansion', releaseDate: '2020-01-01', enabled, isKnown: true,
});

function makeHook(overrides = {}) {
  const rows = [row('NEO'), row('LEA', false)];
  return {
    loading: false,
    saving: false,
    error: null,
    dirty: true,
    rows,
    visibleRows: rows,
    selected: new Set<string>(),
    search: '',
    sort: null,
    setSearch: vi.fn(),
    select: vi.fn(),
    selectAll: vi.fn(),
    toggleEnabled: vi.fn(),
    enableAll: vi.fn(),
    enableSelected: vi.fn(),
    move: vi.fn(),
    restoreDefault: vi.fn(),
    cycleSort: vi.fn(),
    applySortAsPriority: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    discard: vi.fn(),
    ...overrides,
  };
}

describe('ManageSets', () => {
  it('lists sets with their enabled state', () => {
    hoisted.useManageSets.mockReturnValue(makeHook());
    renderWithProviders(<ManageSets />);

    expect(screen.getByText('NEO long')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'NEO' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'LEA' })).not.toBeChecked();
  });

  it('toggles a set without selecting the row', () => {
    const hook = makeHook();
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'LEA' }));
    expect(hook.toggleEnabled).toHaveBeenCalledWith('LEA');
    expect(hook.select).not.toHaveBeenCalled();
  });

  it('selects rows with ctrl/shift modifiers', () => {
    const hook = makeHook();
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);

    fireEvent.click(screen.getByText('LEA'), { ctrlKey: true });
    expect(hook.select).toHaveBeenCalledWith('LEA', { toggle: true, range: false });
  });

  it('disables moves without a selection and while sorted by a column', () => {
    hoisted.useManageSets.mockReturnValue(makeHook());
    const { unmount } = renderWithProviders(<ManageSets />);
    expect(screen.getByRole('button', { name: 'ManageSets.move.top' })).toBeDisabled();
    unmount();

    const hook = makeHook({ selected: new Set(['LEA']) });
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);
    fireEvent.click(screen.getByRole('button', { name: 'ManageSets.move.up' }));
    expect(hook.move).toHaveBeenCalledWith('up');
  });

  it('shows the sort note and offers to keep the sorting as priority', () => {
    const hook = makeHook({ sort: { column: 'code', ascending: true }, selected: new Set(['LEA']) });
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);

    expect(screen.getByRole('button', { name: 'ManageSets.move.up' })).toBeDisabled();
    expect(screen.getByRole('columnheader', { name: /ManageSets.column.code/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'ManageSets.button.useSorting' }));
    expect(hook.applySortAsPriority).toHaveBeenCalled();
  });

  it('switches enable/disable buttons to the selection when several rows are selected', () => {
    const hook = makeHook({ selected: new Set(['NEO', 'LEA']) });
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);

    fireEvent.click(screen.getByRole('button', { name: 'ManageSets.button.disableSelected' }));
    expect(hook.enableSelected).toHaveBeenCalledWith(false);
  });

  it('saves and reports back, or discards on cancel', async () => {
    const hook = makeHook();
    hoisted.useManageSets.mockReturnValue(hook);
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(<ManageSets onSaved={onSaved} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'ManageSets.button.save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'ManageSets.button.cancel' }));
    expect(hook.discard).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('moves and selects rows from the keyboard like desktop', () => {
    const rows = [row('NEO'), row('LEA'), row('M10')];
    const hook = makeHook({ rows, visibleRows: rows });
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);

    const grid = screen.getByRole('grid', { name: 'ManageSets.label.sets' });
    expect(grid).toHaveAttribute('tabindex', '0');
    expect(grid).toHaveAttribute('aria-multiselectable', 'true');

    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(hook.select).toHaveBeenLastCalledWith('NEO', { range: false });
    const neo = screen.getByText('NEO long').closest('[role="row"]')!;
    expect(grid).toHaveAttribute('aria-activedescendant', neo.id);

    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    expect(hook.select).toHaveBeenLastCalledWith('LEA', { range: true });

    hook.select.mockClear();
    fireEvent.keyDown(grid, { key: 'End', ctrlKey: true });
    expect(hook.select).not.toHaveBeenCalled();
    fireEvent.keyDown(grid, { key: ' ', ctrlKey: true });
    expect(hook.select).toHaveBeenCalledWith('M10', { toggle: true, range: false });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(hook.select).toHaveBeenLastCalledWith('M10', { toggle: false, range: false });

    fireEvent.keyDown(grid, { key: 'a', ctrlKey: true });
    expect(hook.selectAll).toHaveBeenCalled();
  });

  it('leaves keys typed in a row\'s checkbox to the checkbox', () => {
    const hook = makeHook();
    hoisted.useManageSets.mockReturnValue(hook);
    renderWithProviders(<ManageSets />);

    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'NEO' }), { key: 'ArrowDown' });
    expect(hook.select).not.toHaveBeenCalled();
  });

  it('shows a failed save as a translated message with the error as detail', () => {
    hoisted.useManageSets.mockReturnValue(makeHook({ error: { key: 'save', detail: 'QuotaExceededError' } }));
    renderWithProviders(<ManageSets />);
    expect(screen.getByRole('alert')).toHaveTextContent('ManageSets.error.save');
  });

  it('explains when no sets are loaded', () => {
    hoisted.useManageSets.mockReturnValue(makeHook({ rows: [], visibleRows: [] }));
    renderWithProviders(<ManageSets />);
    expect(screen.getByText('ManageSets.empty')).toBeInTheDocument();
  });
});
