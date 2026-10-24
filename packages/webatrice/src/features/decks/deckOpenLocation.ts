export type DeckOpenLocation = 'same-tab' | 'new-tab' | 'cancelled';

export type DeckOpenChoice = 'save' | 'discard' | 'new-tab' | 'cancel';

export interface OpenFromEditorState {
  openDeckInNewTab: boolean;
  isModified: boolean;
  isBlank: boolean;
}

export function deckOpenLocation({ openDeckInNewTab, isModified, isBlank }: OpenFromEditorState): DeckOpenLocation | 'prompt' {
  if (openDeckInNewTab) {
    return isBlank ? 'same-tab' : 'new-tab';
  }
  return isModified ? 'prompt' : 'same-tab';
}

export async function resolveDeckOpenChoice(choice: DeckOpenChoice, saveNow: () => Promise<boolean>): Promise<DeckOpenLocation> {
  switch (choice) {
    case 'save':
      return (await saveNow()) ? 'same-tab' : 'cancelled';
    case 'discard':
      return 'same-tab';
    case 'new-tab':
      return 'new-tab';
    default:
      return 'cancelled';
  }
}
