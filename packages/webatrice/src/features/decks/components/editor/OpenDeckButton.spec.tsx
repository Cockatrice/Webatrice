import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';

import { makeDeckList } from '@cockatrice/datatrice/testing';
import {
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { PREFERENCE_DEFAULTS, type PreferenceKey, type Preferences } from '@app/types';
import { connectedState, renderWithProviders } from '../../../../__test-utils__';

const hoisted = vi.hoisted(() => ({ preferences: {} as Partial<Preferences> }));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  usePreference: (key: PreferenceKey) => hoisted.preferences[key] ?? PREFERENCE_DEFAULTS[key],
}));

import { OpenDeckButton, type OpenDeckButtonProps } from './OpenDeckButton';

const deckFile = (id: number, name: string) =>
  create(ServerInfo_DeckStorage_TreeItemSchema, { id, name, file: create(ServerInfo_DeckStorage_FileSchema, {}) });

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname} ${JSON.stringify(location.state)}`}</div>;
}

function renderButton(props: Partial<OpenDeckButtonProps> = {}) {
  const callbacks = {
    saveNow: vi.fn(async () => true),
    discardChanges: vi.fn(),
    pauseAutosave: vi.fn(),
    resumeAutosave: vi.fn(),
  };
  renderWithProviders(
    <>
      <OpenDeckButton deckId={1} isModified={false} isBlank={false} {...callbacks} {...props} />
      <LocationProbe />
    </>,
    {
      route: '/deck/1',
      preloadedState: {
        ...connectedState,
        server: {
          ...(connectedState.server as object),
          backendDecks: makeDeckList({ root: { items: [deckFile(1, 'Current'), deckFile(2, 'Other')] } }),
        } as never,
      },
    },
  );
  return { ...callbacks, ...props };
}

function openOther() {
  fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.label' }));
  fireEvent.click(screen.getByRole('button', { name: 'Other' }));
}

const location = () => screen.getByTestId('location').textContent;
const SAME_TAB = '/deck/2 {"replacesDeckId":1}';
const NEW_TAB = '/deck/2 null';

describe('OpenDeckButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.preferences = {};
  });

  it('lists the other decks in storage', () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.label' }));

    expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Current' })).not.toBeInTheDocument();
  });

  it('opens over an unmodified deck in the same tab, as desktop does by default', () => {
    renderButton();
    openOther();

    expect(location()).toBe(SAME_TAB);
  });

  it('opens in a new tab with "Open deck in new tab by default" on', () => {
    hoisted.preferences = { openDeckInNewTab: true };
    renderButton({ isModified: true });
    openOther();

    expect(screen.queryByRole('dialog', { name: 'OpenDeckButton.confirmTitle' })).not.toBeInTheDocument();
    expect(location()).toBe(NEW_TAB);
  });

  it('opens over a blank new deck in the same tab even with the option on', () => {
    hoisted.preferences = { openDeckInNewTab: true };
    renderButton({ isBlank: true });
    openOther();

    expect(location()).toBe(SAME_TAB);
  });

  describe('a modified deck with the option off', () => {
    it('asks before opening', () => {
      renderButton({ isModified: true });
      openOther();

      expect(screen.getByRole('dialog', { name: 'OpenDeckButton.confirmTitle' })).toBeInTheDocument();
      expect(location()).toBe('/deck/1 null');
    });

    it('saves, then opens in the same tab', async () => {
      const { saveNow } = renderButton({ isModified: true });
      openOther();
      fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.save' }));

      await waitFor(() => expect(location()).toBe(SAME_TAB));
      expect(saveNow).toHaveBeenCalledTimes(1);
    });

    it('stays when the save fails', async () => {
      const saveNow = vi.fn(async () => false);
      renderButton({ isModified: true, saveNow });
      openOther();
      fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.save' }));

      await waitFor(() => expect(saveNow).toHaveBeenCalled());
      expect(location()).toBe('/deck/1 null');
    });

    it('discards the edits, then opens in the same tab', async () => {
      const { discardChanges, saveNow } = renderButton({ isModified: true });
      openOther();
      fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.discard' }));

      await waitFor(() => expect(location()).toBe(SAME_TAB));
      expect(discardChanges).toHaveBeenCalledTimes(1);
      expect(saveNow).not.toHaveBeenCalled();
    });

    it('opens in a new tab, keeping the edits', async () => {
      const { discardChanges, saveNow } = renderButton({ isModified: true });
      openOther();
      fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.openInNewTab' }));

      await waitFor(() => expect(location()).toBe(NEW_TAB));
      expect(discardChanges).not.toHaveBeenCalled();
      expect(saveNow).not.toHaveBeenCalled();
    });

    it('stays on Cancel', async () => {
      renderButton({ isModified: true });
      openOther();
      fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.cancel' }));

      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'OpenDeckButton.confirmTitle' })).not.toBeInTheDocument());
      expect(location()).toBe('/deck/1 null');
    });
  });
});
