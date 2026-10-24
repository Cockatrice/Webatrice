import { type ComponentType } from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';

import { DEFAULT_PLAYMAT_SETTINGS, getPlaymatSettings, setPlaymatSettings, settingsStore } from '@app/hooks';
import { renderWithProviders } from '../../../__test-utils__';

import { CardDTO, SettingDTO } from '@app/services';

import type { CustomControlProps } from '../registry';
import {
  PlaymatCollection,
  PlaymatListModeSelect,
  PlaymatModeSelect,
  PlaymatVisibilitySelect,
} from './PlaymatControls';
import { asDecimal, asPercent } from '@app/utils';
import { movePlaymat } from './playmatList';

const PARAMS = { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 };
const mat = (cardName: string) => ({ cardName, cardProviderId: '', params: PARAMS });
const names = () => getPlaymatSettings().fallbackList.map((entry) => entry.cardName);

function renderControl(Control: ComponentType<CustomControlProps>, label: string) {
  return renderWithProviders(
    <>
      <span id="label">{label}</span>
      <Control id="control" labelId="label" disabled={false} />
    </>,
  );
}

const renderCollection = () => renderControl(PlaymatCollection, 'Collection');

async function openAddForm() {
  fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.addArt' }));
  return screen.getByRole('textbox', { name: 'PlaymatSettings.collection.cardName' });
}

describe('crop value formats', () => {
  it('shows margins as whole percentages and the offset and zoom with two decimals', () => {
    expect(asPercent(0.07)).toBe('7');
    expect(asDecimal(1)).toBe('1.00');
  });
});

describe('movePlaymat', () => {
  it('swaps neighbours and leaves the list alone for an index out of range', () => {
    expect(movePlaymat(['A', 'B', 'C'], 2, 1)).toEqual(['A', 'C', 'B']);
    expect(movePlaymat(['A', 'B'], 0, 2)).toEqual(['A', 'B']);
  });
});

describe('playmat controls', () => {
  beforeEach(async () => {
    await settingsStore.whenReady();
    settingsStore.setValue(new SettingDTO('*app'));
    vi.spyOn(CardDTO, 'get').mockResolvedValue({ name: { value: 'Island' }, set: [] } as unknown as CardDTO);
  });
  afterEach(() => {
    act(() => {
      void setPlaymatSettings(DEFAULT_PLAYMAT_SETTINGS);
    });
  });

  it('shows desktop\'s defaults and saves each choice as soon as it is made', () => {
    renderWithProviders(
      <>
        <span id="v">Visibility</span>
        <PlaymatVisibilitySelect id="vs" labelId="v" disabled={false} />
        <span id="m">Mode</span>
        <PlaymatModeSelect id="ms" labelId="m" disabled={false} />
        <span id="l">List</span>
        <PlaymatListModeSelect id="ls" labelId="l" disabled={false} />
      </>,
    );
    const visibility = screen.getByRole('combobox', { name: 'Visibility' });
    const mode = screen.getByRole('combobox', { name: 'Mode' });
    const list = screen.getByRole('combobox', { name: 'List' });
    expect(visibility).toHaveDisplayValue('PlaymatSettings.visibility.all');
    expect(mode).toHaveDisplayValue('PlaymatSettings.mode.fallback');
    expect(list).toHaveDisplayValue('PlaymatSettings.collection.fixed');

    fireEvent.change(visibility, { target: { value: '1' } });
    fireEvent.change(mode, { target: { value: '0' } });
    fireEvent.change(list, { target: { value: '2' } });

    expect(getPlaymatSettings()).toMatchObject({ visibility: 1, mode: 0, fallbackBehavior: 2 });
  });

  it('says the collection is empty and offers to add card art', () => {
    renderCollection();
    expect(screen.getByText('PlaymatSettings.collection.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PlaymatSettings.collection.addArt' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('adds a card to the collection and opens its crop editor', async () => {
    renderCollection();

    fireEvent.change(await openAddForm(), { target: { value: '  Island ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }));
    });

    expect(getPlaymatSettings().fallbackList).toEqual([mat('Island')]);
    expect(screen.getByRole('group', { name: 'PlaymatSettings.crop.title' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'PlaymatSettings.collection.cardName' })).not.toBeInTheDocument();
  });

  it.each([
    ['Not a real card', 'PlaymatSettings.validation.unknownCard'],
    ['x'.repeat(256), 'PlaymatSettings.validation.tooLong'],
  ])('rejects invalid card %s', async (cardName, message) => {
    vi.mocked(CardDTO.get).mockResolvedValue(undefined);
    renderCollection();
    fireEvent.change(await openAddForm(), { target: { value: cardName } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }).closest('form')!);
    });
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(getPlaymatSettings().fallbackList).toEqual([]);
  });

  it('reports lookup failure without losing the entered name', async () => {
    vi.mocked(CardDTO.get).mockRejectedValue(new Error('database unavailable'));
    renderCollection();
    const input = await openAddForm();
    fireEvent.change(input, { target: { value: 'Island' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }).closest('form')!);
    });
    expect(screen.getByText('PlaymatSettings.validation.lookupFailed')).toBeInTheDocument();
    expect(input).toHaveValue('Island');
    expect(getPlaymatSettings().fallbackList).toEqual([]);
  });

  it('drops an add that is cancelled while the card is still being looked up', async () => {
    let resolve: (card: CardDTO) => void = () => {};
    vi.mocked(CardDTO.get).mockReturnValue(new Promise<CardDTO>((r) => {
      resolve = r;
    }) as ReturnType<typeof CardDTO.get>);
    renderCollection();
    fireEvent.change(await openAddForm(), { target: { value: 'Island' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.cancel' }));
    expect(screen.getByRole('button', { name: 'PlaymatSettings.collection.addArt' })).toHaveFocus();
    await act(async () => {
      resolve({ name: { value: 'Island' }, set: [] } as unknown as CardDTO);
    });

    expect(getPlaymatSettings().fallbackList).toEqual([]);
    expect(screen.queryByRole('group', { name: 'PlaymatSettings.crop.title' })).not.toBeInTheDocument();
  });

  it('locks Cancel once the new card is being saved, so a cancel cannot leave it saved behind the user', async () => {
    let finishSave: () => void = () => {};
    const save = vi.spyOn(SettingDTO.prototype, 'save').mockReturnValue(new Promise((resolve) => {
      finishSave = () => resolve('*app');
    }) as ReturnType<SettingDTO['save']>);
    renderCollection();
    const input = await openAddForm();
    fireEvent.change(input, { target: { value: 'Island' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }));
    });

    const cancel = screen.getByRole('button', { name: 'PlaymatSettings.collection.cancel' });
    const addArt = screen.getByRole('button', { name: 'PlaymatSettings.collection.addArt' });
    expect(cancel).toBeDisabled();
    expect(addArt).toBeDisabled();
    fireEvent.click(cancel);
    fireEvent.click(addArt);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toBeInTheDocument();

    await act(async () => {
      finishSave();
    });
    expect(names()).toEqual(['Island']);
    expect(screen.getByRole('group', { name: 'PlaymatSettings.crop.title' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'PlaymatSettings.collection.cardName' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PlaymatSettings.collection.addArt' })).toBeEnabled();
    save.mockRestore();
  });

  it('keeps the typed name and says so when saving the new card fails', async () => {
    const save = vi.spyOn(SettingDTO.prototype, 'save').mockRejectedValue(new Error('quota'));
    renderCollection();
    const input = await openAddForm();
    fireEvent.change(input, { target: { value: 'Island' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }));
    });

    expect(screen.getByText('PlaymatSettings.validation.saveFailed')).toBeInTheDocument();
    expect(input).toHaveValue('Island');
    expect(input).toBeInTheDocument();
    save.mockRestore();
  });

  it('requires a card name, and Cancel closes the form', async () => {
    renderCollection();
    await openAddForm();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.add' }));
    });
    expect(screen.getByText('Common.validation.required')).toBeInTheDocument();
    expect(getPlaymatSettings().fallbackList).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.cancel' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reorders and removes entries, naming the card on each button', () => {
    act(() => {
      void setPlaymatSettings({ fallbackList: [mat('A'), mat('B'), mat('C')] });
    });
    renderCollection();
    const tiles = () => within(screen.getByRole('group', { name: 'Collection' })).getAllByRole('listitem');
    expect(within(tiles()[0]).getByRole('button', { name: 'PlaymatSettings.collection.moveEarlier' })).toBeDisabled();
    expect(within(tiles()[2]).getByRole('button', { name: 'PlaymatSettings.collection.moveLater' })).toBeDisabled();

    fireEvent.click(within(tiles()[2]).getByRole('button', { name: 'PlaymatSettings.collection.moveEarlier' }));
    expect(names()).toEqual(['A', 'C', 'B']);

    fireEvent.click(within(tiles()[0]).getByRole('button', { name: 'PlaymatSettings.collection.moveLater' }));
    expect(names()).toEqual(['C', 'A', 'B']);

    fireEvent.click(within(tiles()[1]).getByRole('button', { name: 'PlaymatSettings.collection.removeCard' }));
    expect(names()).toEqual(['C', 'B']);
  });

  it('edits an entry\'s crop and closes the editor with Done', () => {
    act(() => {
      void setPlaymatSettings({ fallbackList: [mat('A')] });
    });
    renderCollection();

    const edit = screen.getByRole('button', { name: 'PlaymatSettings.collection.editCrop' });
    fireEvent.click(edit);
    expect(edit).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('slider', { name: 'PlaymatSettings.crop.zoom' }), { target: { value: 2.5 } });
    expect(getPlaymatSettings().fallbackList[0].params).toEqual({ ...PARAMS, zoom: 2.5 });

    fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.done' }));
    expect(screen.queryByRole('group', { name: 'PlaymatSettings.crop.title' })).not.toBeInTheDocument();
    expect(edit).toHaveFocus();
  });

  it('saves a dragged crop once, on release, and announces the margins as percentages', () => {
    act(() => {
      void setPlaymatSettings({ fallbackList: [mat('A')] });
    });
    renderCollection();
    fireEvent.click(screen.getByRole('button', { name: 'PlaymatSettings.collection.editCrop' }));

    const left = screen.getByRole('slider', { name: 'PlaymatSettings.crop.leftMargin' });
    expect(left).toHaveAttribute('aria-valuetext', '7');
    expect(left).toHaveAttribute('step', '0.01');
    expect(left).toHaveAttribute('max', '0.95');
    const saved = getPlaymatSettings();

    fireEvent.input(left, { target: { value: '0.2' } });
    expect(getPlaymatSettings()).toBe(saved);
    expect(left).toHaveAttribute('aria-valuetext', '20');

    fireEvent.change(left);
    expect(getPlaymatSettings().fallbackList[0].params).toEqual({ ...PARAMS, marginPctL: 0.2 });
  });
});
