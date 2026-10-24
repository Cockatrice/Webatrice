import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { games } from '@cockatrice/datatrice';
import { lookupCard } from '@app/services';

import { DeckPlaymatDialog } from './DeckPlaymatDialog';

vi.mock('@app/services', async (original) => ({
  ...await original<typeof import('@app/services')>(), lookupCard: vi.fn(),
}));
vi.mock('../hooks/useQuickAddSuggestions', () => ({ useQuickAddSuggestions: () => ({ suggestions: [] }) }));
const playmat: games.Playmat = {
  cardName: 'Island', cardProviderId: 'missing-printing', params: { ...games.DEFAULT_PLAYMAT_PARAMS, zoom: 1.75 },
};
beforeEach(() => {
  vi.mocked(lookupCard).mockResolvedValue({ found: true, name: 'Island', source: 'dexie', printings: [
    { set: 'ABC', collectorNumber: '12', scryfallId: 'new-printing' },
  ] });
});

it('keeps the saved printing and params when that printing cannot be resolved locally', async () => {
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={playmat} onClose={vi.fn()} onSave={onSave} />);
  await screen.findByRole('option', { name: 'ABC 12' });
  expect(screen.getByRole('combobox', { name: 'DeckPlaymat.printing' })).toHaveValue('missing-printing');
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(playmat));
});

it('supports picking a card and printing with desktop defaults', async () => {
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={null} onClose={vi.fn()} onSave={onSave} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckPlaymat.card' }), { target: { value: 'Island' } });
  await screen.findByRole('option', { name: 'ABC 12' });
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckPlaymat.printing' }), { target: { value: 'new-printing' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    ...playmat, cardProviderId: 'new-printing', params: games.DEFAULT_PLAYMAT_PARAMS,
  }));
});

it('cancels without saving and removes explicitly', () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<DeckPlaymatDialog playmat={playmat} onClose={onClose} onSave={onSave} />);
  fireEvent.click(screen.getByRole('button', { name: 'Common.action.cancel' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.remove' }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith(null);
});

it('accepts precise numeric crop values without changing the card or printing', async () => {
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={playmat} onClose={vi.fn()} onSave={onSave} />);
  document.querySelector('details')!.open = true;
  fireEvent.change(screen.getByRole('spinbutton', { name: 'PlaymatSettings.crop.zoom' }), { target: { value: '2.125' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...playmat, params: { ...playmat.params, zoom: 2.125 } }));
});

it('rejects unknown cards and keeps the dialog editable', async () => {
  vi.mocked(lookupCard).mockResolvedValue({ found: false, name: 'unknown', source: 'unknown', printings: [] });
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={null} onClose={vi.fn()} onSave={onSave} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckPlaymat.card' }), { target: { value: 'unknown' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('DeckPlaymat.unknownCard');
  expect(onSave).not.toHaveBeenCalled();
});

it('retains the current playmat when the search field is cleared, until Remove is chosen', async () => {
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={playmat} onClose={vi.fn()} onSave={onSave} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckPlaymat.card' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(playmat));
});

it('ignores validation finishing after the dialog unmounts', async () => {
  let finish!: (value: Awaited<ReturnType<typeof lookupCard>>) => void;
  vi.mocked(lookupCard).mockImplementation(() => new Promise((resolve) => {
    finish = resolve;
  }));
  const onSave = vi.fn();
  const view = render(<DeckPlaymatDialog playmat={null} onClose={vi.fn()} onSave={onSave} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckPlaymat.card' }), { target: { value: 'Island' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(lookupCard).toHaveBeenCalled());
  view.unmount();
  await act(async () => finish({ found: true, name: 'Island', source: 'dexie', printings: [] }));
  expect(onSave).not.toHaveBeenCalled();
});

it('keeps numeric fields synchronized with crop sliders', async () => {
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={playmat} onClose={vi.fn()} onSave={onSave} />);
  document.querySelector('details')!.open = true;
  fireEvent.change(screen.getByRole('slider', { name: 'PlaymatSettings.crop.zoom' }), { target: { value: '2' } });
  expect(screen.getByRole('spinbutton', { name: 'PlaymatSettings.crop.zoom' })).toHaveValue(2);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'PlaymatSettings.crop.zoom' }), { target: { value: '2.125' } });
  expect(screen.getByRole('slider', { name: 'PlaymatSettings.crop.zoom' })).toHaveValue('2.125');
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...playmat, params: { ...playmat.params, zoom: 2.125 } }));
});

it('restores the original printing when the original card name is retyped', async () => {
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={playmat} onClose={vi.fn()} onSave={onSave} />);
  const input = screen.getByRole('combobox', { name: 'DeckPlaymat.card' });
  fireEvent.change(input, { target: { value: 'Swamp' } });
  await screen.findByRole('option', { name: 'ABC 12' });
  fireEvent.change(input, { target: { value: 'Island' } });
  expect(screen.getByRole('combobox', { name: 'DeckPlaymat.printing' })).toHaveValue('missing-printing');
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(playmat));
});

it('keeps the default printing empty when the card pin is stale', async () => {
  vi.mocked(lookupCard).mockResolvedValue({
    found: true, name: 'Island', source: 'dexie', pinnedPrintingId: 'stale',
    printings: [{ set: 'ABC', collectorNumber: '12', scryfallId: 'other' }],
  });
  const onSave = vi.fn();
  render(<DeckPlaymatDialog playmat={null} onClose={vi.fn()} onSave={onSave} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckPlaymat.card' }), { target: { value: 'Island' } });
  await screen.findByRole('option', { name: 'ABC 12' });
  expect(screen.getByRole('combobox', { name: 'DeckPlaymat.printing' })).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'DeckPlaymat.ok' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cardName: 'Island', cardProviderId: '' })));
});
