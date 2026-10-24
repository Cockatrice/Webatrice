import { act, renderHook, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ getSetInventory: vi.fn(), saveSetPreferences: vi.fn() }));

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  cardDatabaseService: hoisted,
}));

import { useManageSets } from './useManageSets';

const sets = [
  { name: { value: 'NEO' }, longname: { value: 'Neon' }, releasedate: { value: '2022-02-18' } },
  { name: { value: 'LEA' }, longname: { value: 'Alpha' }, releasedate: { value: '1993-08-05' } },
  { name: { value: 'M10' }, longname: { value: 'Magic 2010' }, releasedate: { value: '2009-07-17' } },
];
const preferences = [
  { code: 'LEA', sortKey: 1, enabled: true, isKnown: true },
  { code: 'NEO', sortKey: 2, enabled: false, isKnown: true },
  { code: 'M10', sortKey: 3, enabled: true, isKnown: true },
];

async function renderLoaded() {
  hoisted.getSetInventory.mockResolvedValue({ sets, preferences });
  const hook = renderHook(() => useManageSets());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

const codes = (rows: Array<{ code: string }>) => rows.map((r) => r.code);

describe('useManageSets', () => {
  it('loads rows in priority order', async () => {
    const { result } = await renderLoaded();
    expect(codes(result.current.rows)).toEqual(['LEA', 'NEO', 'M10']);
    expect(result.current.dirty).toBe(false);
  });

  it('moves the selection and saves sort keys 1..n', async () => {
    hoisted.saveSetPreferences.mockResolvedValue(undefined);
    const { result } = await renderLoaded();

    act(() => result.current.select('M10'));
    act(() => result.current.move('top'));
    expect(codes(result.current.rows)).toEqual(['M10', 'LEA', 'NEO']);
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.save();
    });
    expect(hoisted.saveSetPreferences).toHaveBeenCalledWith([
      { code: 'M10', sortKey: 1, enabled: true, isKnown: true },
      { code: 'LEA', sortKey: 2, enabled: true, isKnown: true },
      { code: 'NEO', sortKey: 3, enabled: false, isKnown: true },
    ]);
    expect(result.current.dirty).toBe(false);
  });

  it('selects ranges and toggles with modifiers', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.select('LEA'));
    act(() => result.current.select('M10', { range: true }));
    expect([...result.current.selected]).toEqual(['LEA', 'NEO', 'M10']);

    act(() => result.current.select('NEO', { toggle: true }));
    expect([...result.current.selected]).toEqual(['LEA', 'M10']);
  });

  it('selects every set the search shows', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.setSearch('magic'));
    act(() => result.current.selectAll());
    expect([...result.current.selected]).toEqual(['M10']);
  });

  it('cycles column sort ascending → descending → off and blocks moves while sorted', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.cycleSort('code'));
    expect(codes(result.current.visibleRows)).toEqual(['LEA', 'M10', 'NEO']);
    act(() => result.current.cycleSort('code'));
    expect(codes(result.current.visibleRows)).toEqual(['NEO', 'M10', 'LEA']);

    act(() => result.current.select('LEA'));
    act(() => result.current.move('bottom'));
    expect(codes(result.current.rows)).toEqual(['LEA', 'NEO', 'M10']);

    act(() => result.current.cycleSort('code'));
    expect(result.current.sort).toBeNull();
  });

  it('can adopt the current column sort as the priority', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.cycleSort('longName'));
    act(() => result.current.applySortAsPriority());
    expect(codes(result.current.rows)).toEqual(['LEA', 'M10', 'NEO']);
    expect(result.current.sort).toBeNull();
  });

  it('restores the default order and discards unsaved edits', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.restoreDefault());
    expect(codes(result.current.rows)).toEqual(['NEO', 'M10', 'LEA']);

    act(() => result.current.enableAll(false));
    act(() => result.current.discard());
    expect(codes(result.current.rows)).toEqual(['LEA', 'NEO', 'M10']);
    expect(result.current.rows[0].enabled).toBe(true);
  });

  it('filters by search text', async () => {
    const { result } = await renderLoaded();
    act(() => result.current.setSearch('magic'));
    expect(codes(result.current.visibleRows)).toEqual(['M10']);
  });

  it('surfaces a save failure', async () => {
    hoisted.saveSetPreferences.mockRejectedValue(new Error('quota'));
    const { result } = await renderLoaded();
    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });
    expect(ok).toBe(false);
    expect(result.current.error).toEqual({ key: 'save', detail: 'quota' });
  });
});
