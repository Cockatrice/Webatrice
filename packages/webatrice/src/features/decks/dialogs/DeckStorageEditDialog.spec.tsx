import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { FlatDeck } from '../deckTree';
import { useDeckStorageDetails } from '../hooks/useDeckStorageDetails';
import { DeckStorageEditDialog } from './DeckStorageEditDialog';

vi.mock('../hooks/useDeckStorageDetails', () => ({ useDeckStorageDetails: vi.fn() }));

const deck: FlatDeck = { id: 7, name: 'Deck', path: '', creationTime: 0, visibility: 'private', colorIdentity: 'UB' };
const save = vi.fn();
const activate = vi.fn();
type Details = ReturnType<typeof useDeckStorageDetails>;
const details = (patch: Partial<Details> = {}): Details => ({
  deck: {
    name: 'Deck', format: 'modern', meta: { v: 1, updatedAt: '' }, bannerCard: 'Island',
    cards: [{ name: 'Swamp', category: 'main', quantity: 1, lookupSource: 'unknown' }],
    tagsXml: '<tags><tag>Ramp</tag></tags>',
  },
  disabled: false, editorHasChanges: false, error: null, saving: false, save, activate,
  failedEdit: null, discardFailed: undefined, ...patch,
});

beforeEach(() => {
  save.mockResolvedValue(true);
  vi.mocked(useDeckStorageDetails).mockReturnValue(details());
});

function renderDialog(kind: 'rename' | 'tags' | 'banner') {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(<DeckStorageEditDialog kind={kind} deck={deck} xml="xml" onSaved={onSaved} onClose={onClose} />);
  const rerender = () => view.rerender(<DeckStorageEditDialog kind={kind} deck={deck} xml="xml" onSaved={onSaved} onClose={onClose} />);
  return { onClose, onSaved, rerender };
}

it('loads the stored deck once and renames it, closing on success', async () => {
  const { onClose } = renderDialog('rename');
  expect(activate).toHaveBeenCalledOnce();
  expect(useDeckStorageDetails).toHaveBeenCalledWith(7, 'xml', expect.any(Function), 'UB');
  const name = screen.getByRole('textbox', { name: 'DeckStorageEditDialog.name' });
  expect(name).toHaveValue('Deck');
  fireEvent.change(name, { target: { value: '  Fire & Ice ' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(save).toHaveBeenCalledWith({ name: 'Fire & Ice' });
});

it('refuses an empty name', () => {
  renderDialog('rename');
  fireEvent.change(screen.getByRole('textbox', { name: 'DeckStorageEditDialog.name' }), { target: { value: '  ' } });
  expect(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' })).toBeDisabled();
});

it('edits tags as a draft and saves them together', async () => {
  renderDialog('tags');
  fireEvent.click(screen.getByRole('button', { name: 'DeckTags.remove' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ tags: [] }));
});

it('sets the banner from the deck\'s cards', async () => {
  renderDialog('banner');
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckBanner.label' }), { target: { value: '["Swamp",""]' } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ banner: { name: 'Swamp', providerId: undefined } }));
});

it('warns and blocks saving while the editor has unsaved changes to the deck', () => {
  vi.mocked(useDeckStorageDetails).mockReturnValue(details({ editorHasChanges: true, disabled: true }));
  renderDialog('rename');
  expect(screen.getByRole('alert')).toHaveTextContent('DeckStorageEditDialog.editorHasChanges');
  expect(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' })).toBeDisabled();
});

it('stays open when saving fails', async () => {
  save.mockResolvedValue(false);
  const { onClose } = renderDialog('rename');
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('shows loading until the stored deck is ready', () => {
  vi.mocked(useDeckStorageDetails).mockReturnValue(details({ deck: null, disabled: true }));
  renderDialog('tags');
  expect(screen.getByRole('status')).toHaveTextContent('DeckStorageEditDialog.loading');
  expect(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' })).toBeDisabled();
});

it('offers the failed edit again after a remount, with retry and discard', async () => {
  const discardFailed = vi.fn();
  vi.mocked(useDeckStorageDetails).mockReturnValue(details({ failedEdit: { name: 'Lost rename' }, discardFailed }));
  const { onClose } = renderDialog('rename');
  expect(screen.getByRole('textbox', { name: 'DeckStorageEditDialog.name' })).toHaveValue('Lost rename');
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('DeckStorageEditDialog.lastSaveFailed');
  fireEvent.click(within(alert).getByRole('button', { name: 'DeckStorageEditDialog.discard' }));
  expect(discardFailed).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageEditDialog.retry' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(save).toHaveBeenCalledWith({ name: 'Lost rename' });
});

it('replaces the draft with the latest stored version after a conflict', () => {
  const { rerender } = renderDialog('rename');
  fireEvent.change(screen.getByRole('textbox', { name: 'DeckStorageEditDialog.name' }), { target: { value: 'Mine' } });
  const latest = details();
  vi.mocked(useDeckStorageDetails).mockReturnValue({
    ...latest, deck: { ...latest.deck!, name: 'Theirs' }, error: 'DeckStorageEditDialog.changedElsewhere',
  });
  rerender();
  expect(screen.getByRole('textbox', { name: 'DeckStorageEditDialog.name' })).toHaveValue('Theirs');
  expect(screen.getByRole('alert')).toHaveTextContent('DeckStorageEditDialog.changedElsewhere');
});
