import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import { Button } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { usePreference } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { RouteEnum, type DeckRouteState } from '@app/types';

import { deckOpenLocation, resolveDeckOpenChoice, type DeckOpenChoice, type DeckOpenLocation } from '../../deckOpenLocation';
import { flattenFolder, type FlatDeck } from '../../deckTree';

export interface OpenDeckFlowProps {
  deckId: number | null;
  isModified: boolean;
  isBlank: boolean;
  saveNow: () => Promise<boolean>;
  discardChanges: () => void;
  pauseAutosave: () => void;
  resumeAutosave: () => void;
}

export interface OpenDeckFlow {
  openPicker: () => void;
  dialogs: ReactNode;
}

export function useOpenDeck({
  deckId, isModified, isBlank, saveNow, discardChanges, pauseAutosave, resumeAutosave,
}: OpenDeckFlowProps): OpenDeckFlow {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openDeckInNewTab = usePreference('openDeckInNewTab');
  const backendDecks = useAppSelector(server.Selectors.getBackendDecks);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<FlatDeck | null>(null);

  const decks = useMemo(
    () => (backendDecks?.root ? flattenFolder(backendDecks.root, '') : [])
      .filter((deck) => deck.id !== deckId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [backendDecks, deckId],
  );

  const open = (deck: FlatDeck, location: DeckOpenLocation) => {
    if (location === 'cancelled') {
      return;
    }
    const route = generatePath(RouteEnum.DECK, { deckId: String(deck.id) });
    navigate(route, location === 'same-tab' && deckId != null ? { state: { replacesDeckId: deckId } satisfies DeckRouteState } : undefined);
  };

  const pick = (deck: FlatDeck) => {
    setPickerOpen(false);
    const location = deckOpenLocation({ openDeckInNewTab, isModified, isBlank });
    if (location === 'prompt') {
      pauseAutosave();
      setPending(deck);
    } else {
      open(deck, location);
    }
  };

  const choose = async (choice: DeckOpenChoice) => {
    const deck = pending;
    setPending(null);
    if (!deck) {
      return;
    }
    let location: DeckOpenLocation;
    try {
      if (choice === 'discard') {
        discardChanges();
      }
      location = await resolveDeckOpenChoice(choice, saveNow);
    } finally {
      resumeAutosave();
    }
    open(deck, location);
  };

  const dialogs = (
    <>
      <DialogShell isOpen={pickerOpen} handleClose={() => setPickerOpen(false)} title={t('OpenDeckButton.pickerTitle')}>
        {decks.length === 0 ? (
          <p>{t('OpenDeckButton.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {decks.map((deck) => (
              <li key={deck.id}>
                <button
                  type="button"
                  onClick={() => pick(deck)}
                  className={[
                    'w-full rounded-ui px-3 py-2 text-left text-text-primary hover:bg-bg-elevated',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  ].join(' ')}
                >
                  {deck.path ? `${deck.path}/${deck.name}` : deck.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogShell>

      <DialogShell isOpen={pending !== null} handleClose={() => void choose('cancel')} title={t('OpenDeckButton.confirmTitle')}>
        <p className="whitespace-pre-line">{t('OpenDeckButton.confirmMessage')}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={() => void choose('cancel')}>{t('OpenDeckButton.cancel')}</Button>
          <Button variant="quiet" onClick={() => void choose('new-tab')}>{t('OpenDeckButton.openInNewTab')}</Button>
          <Button variant="quiet" onClick={() => void choose('discard')}>{t('OpenDeckButton.discard')}</Button>
          <Button variant="primary" onClick={() => void choose('save')}>{t('OpenDeckButton.save')}</Button>
        </div>
      </DialogShell>
    </>
  );

  return { openPicker: () => setPickerOpen(true), dialogs };
}

export type OpenDeckButtonProps = OpenDeckFlowProps;

export function OpenDeckButton(props: OpenDeckButtonProps) {
  const { t } = useTranslation();
  const { openPicker, dialogs } = useOpenDeck(props);
  return (
    <>
      <Button icon={<FolderOpen size={13} />} onClick={openPicker}>{t('OpenDeckButton.label')}</Button>
      {dialogs}
    </>
  );
}
