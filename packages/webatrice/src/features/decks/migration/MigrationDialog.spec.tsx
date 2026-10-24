import { fireEvent, screen } from '@testing-library/react';

import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { lookupCards } from '@app/services';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../../__test-utils__';
import { MigrationDialog } from './MigrationDialog';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCards: vi.fn(),
}));

const registered = {
  ...connectedState,
  server: { ...(connectedState.server as object), user: makeUser({ userLevel: ServerInfo_User_UserLevelFlag.IsRegistered }) },
} as typeof connectedState;

function setup(state = registered) {
  const onPasteInstead = vi.fn();
  renderWithProviders(
    <MigrationDialog open onClose={() => {}} onPasteInstead={onPasteInstead} />,
    { preloadedState: state, webClient: createMockWebClient() },
  );
  return { onPasteInstead };
}

beforeEach(() => {
  vi.mocked(lookupCards).mockResolvedValue(new Map());
});

it('shows where desktop keeps its files for each system and lets the user paste instead', () => {
  const { onPasteInstead } = setup();
  fireEvent.click(screen.getByRole('radio', { name: 'DeckMigration.os.macos' }));
  expect(screen.getByText('~/Library/Application Support/Cockatrice/Cockatrice')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'DeckMigration.os.windows' }));
  expect(screen.getByText('%LOCALAPPDATA%\\Cockatrice\\Cockatrice')).toBeInTheDocument();
  expect(screen.queryByText('DeckMigration.guest')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'DeckMigration.source.paste' }));
  expect(onPasteInstead).toHaveBeenCalledOnce();
});

it('picks a folder and previews the decks it found', async () => {
  setup();
  const folderInput = screen.getByLabelText('DeckMigration.source.pickFolder') as HTMLInputElement;
  expect(folderInput).toHaveAttribute('webkitdirectory');
  const burn = new File(['4 Lightning Bolt'], 'burn.txt');
  Object.defineProperty(burn, 'webkitRelativePath', { value: 'Cockatrice/decks/Modern/burn.txt' });
  fireEvent.change(folderInput, { target: { files: [burn] } });

  expect(await screen.findByText('burn')).toBeInTheDocument();
  expect(screen.getByText('Modern')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'DeckMigration.preview.import' })).toBeEnabled();
});

it('explains that decks need a registered account', () => {
  setup(connectedState);
  expect(screen.getByText('DeckMigration.guest')).toBeInTheDocument();
});

it('lists the lines a deck file had that could not be read', async () => {
  setup();
  const burn = new File(['4 Lightning Bolt\n==== junk ===='], 'burn.txt');
  Object.defineProperty(burn, 'webkitRelativePath', { value: 'Cockatrice/decks/burn.txt' });
  fireEvent.change(screen.getByLabelText('DeckMigration.source.pickFolder'), { target: { files: [burn] } });

  expect(await screen.findByText('DeckMigration.preview.ignored')).toBeInTheDocument();
  expect(screen.getByText('==== junk ====')).toBeInTheDocument();
});
