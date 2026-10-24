
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import {
  battlefieldEl,
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  openContextMenu,
  pileEl,
  type SeatGameSpec,
} from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/catalog/lookup', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async (inputs: Array<string | { name: string }>) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, unknown(name)];
      }))),
    lookupCardsCached: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, unknown(n)]))),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

const BEAR = makeCard({ id: 10, name: 'Bear', x: 3, y: 1, pt: '2/2', annotation: 'old' });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 1,
  seats: [
    { playerId: 1, life: 20, table: [BEAR], hand: [], deckCount: 6 },
    { playerId: 2, handCount: 5, deckCount: 33 },
  ],
};

type GameCalls = ReturnType<typeof createMockWebClient>['request']['game'];

function renderSeats() {
  const webClient = createMockWebClient();
  const { unmount } = renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient });
  return Object.assign(webClient.request.game, { unmount });
}

function wire(game: GameCalls): string[] {
  return Object.entries(game)
    .filter(([, fn]) => vi.isMockFunction(fn))
    .flatMap(([name, fn]) => {
      const mock = vi.mocked(fn as (...args: unknown[]) => unknown).mock;
      return mock.calls.map((args, i) => ({
        name,
        args: args.slice(1).filter((a) => a !== undefined && JSON.stringify(a) !== '{}'),
        order: mock.invocationCallOrder[i],
      }));
    })
    .sort((a, b) => a.order - b.order)
    .map(({ name, args }) => `${name} ${args.map(compact).join(' ')}`);
}

function compact(value: unknown): string {
  const flat = JSON.stringify(value).replace(/"([\w/+ ]*)"/g, '$1');
  if (flat.length <= 100 || typeof value !== 'object' || value === null || Array.isArray(value)) {
    return flat;
  }
  return Object.entries(value).map(([key, v]) => `
    ${key}: ${compact(v)}`).join('');
}

interface PromptCase {
  open: () => void;
  dialog: RegExp;
  initial: string;
  invalid?: string;
  answer: string;
}

const CASES: Record<string, PromptCase> = {
  'set life': {
    open: () => {
      openContextMenu(battlefieldEl(1));
      chooseMenuPath('Counters', 'Life', 'Set counter...');
    },
    dialog: /^set life total$/i,
    initial: '20',
    invalid: '20+',
    answer: '20+5',
  },
  'set a mana counter': {
    open: () => {
      openContextMenu(battlefieldEl(1));
      chooseMenuPath('Counters', 'White', 'Set counter...');
    },
    dialog: /^set counter$/i,
    initial: '0',
    invalid: 'w',
    answer: '3',
  },
  'set P/T': {
    open: () => {
      openContextMenu(cardEl(BEAR.id, 'battlefield'));
      chooseMenuPath('Power / toughness', 'Set power and toughness...');
    },
    dialog: /^change power\/toughness$/i,
    initial: '2/2',
    answer: '+1/+1',
  },
  'set annotation': {
    open: () => {
      openContextMenu(cardEl(BEAR.id, 'battlefield'));
      chooseMenuPath('Set annotation...');
    },
    dialog: /^set annotation$/i,
    initial: 'old',
    answer: 'new note',
  },
  'set a card counter': {
    open: () => {
      openContextMenu(cardEl(BEAR.id, 'battlefield'));
      chooseMenuPath('Card counters', 'Set counters (B)...');
    },
    dialog: /^set counter b$/i,
    initial: '0',
    invalid: '-2',
    answer: '4',
  },
  'draw cards': {
    open: () => {
      openContextMenu(pileEl('Library', 0));
      chooseMenuPath('Draw cards...');
    },
    dialog: /^draw cards$/i,
    initial: '1',
    invalid: '0',
    answer: '9',
  },
  'view top cards': {
    open: () => {
      openContextMenu(pileEl('Library', 0));
      chooseMenuPath('View top cards of library...');
    },
    dialog: /^view top cards of library$/i,
    initial: '3',
    invalid: '0',
    answer: '3',
  },
  'reveal top cards to a player': {
    open: () => {
      openContextMenu(pileEl('Library', 0));
      chooseMenuPath('Reveal top cards to...', 'P2');
    },
    dialog: /reveal top/i,
    initial: '3',
    invalid: '0',
    answer: '2',
  },
  'shuffle top cards': {
    open: () => {
      openContextMenu(pileEl('Library', 0));
      chooseMenuPath('Top of library...', 'Shuffle top cards...');
    },
    dialog: /^shuffle top cards of library$/i,
    initial: '3',
    invalid: '0',
    answer: '4',
  },
  'move a card X from the top': {
    open: () => {
      openContextMenu(cardEl(BEAR.id, 'battlefield'));
      chooseMenuPath('Move to', 'X cards from the top of library...');
    },
    dialog: /^place card x cards from top of library$/i,
    initial: '1',
    invalid: '0',
    answer: '99',
  },
};

function promptDialog(name: RegExp): HTMLElement {
  return screen.getByRole('dialog', { name });
}

function promptInput(dialog: HTMLElement): HTMLInputElement {
  return (within(dialog).queryByRole('spinbutton') ?? within(dialog).getByRole('textbox')) as HTMLInputElement;
}

function answer(dialog: HTMLElement, value: string) {
  const input = promptInput(dialog);
  fireEvent.change(input, { target: { value } });
  act(() => {
    fireEvent.submit(input.closest('form')!);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seat prompts', () => {
  describe.each(Object.entries(CASES))('%s', (_name, c) => {
    it('opens with its default', () => {
      renderSeats();
      c.open();
      expect(promptInput(promptDialog(c.dialog)).value).toBe(c.initial);
    });

    it('sends nothing when cancelled, by button or Escape', () => {
      const game = renderSeats();
      c.open();
      fireEvent.click(within(promptDialog(c.dialog)).getByRole('button', { name: 'Common.action.cancel' }));
      expect(screen.queryByRole('dialog', { name: c.dialog })).not.toBeInTheDocument();

      c.open();
      act(() => {
        fireEvent.keyDown(promptInput(promptDialog(c.dialog)), { key: 'Escape', code: 'Escape' });
      });
      expect(screen.queryByRole('dialog', { name: c.dialog })).not.toBeInTheDocument();
      expect(wire(game)).toEqual([]);
    });

    if (c.invalid != null) {
      it('sends nothing for an invalid answer', () => {
        const game = renderSeats();
        c.open();
        answer(promptDialog(c.dialog), c.invalid!);
        expect(wire(game)).toEqual([]);
      });
    }
  });

  it('sends exactly these commands for a valid answer', () => {
    const log = Object.entries(CASES).map(([name, c]) => {
      const game = renderSeats();
      c.open();
      answer(promptDialog(c.dialog), c.answer);
      const sent = wire(game);
      const open = screen.queryByRole('dialog', { name: c.dialog }) != null;
      game.unmount();
      return `${name} [${c.answer}]${open ? ' (still open)' : ''}\n${sent.map((s) => `  ${s}`).join('\n')}`;
    });
    expect(`\n${log.join('\n')}\n`).toMatchInlineSnapshot(`
      "
      set life [20+5]
        setCounter {counterId:1,value:25}
      set a mana counter [3]
        setCounter {counterId:2,value:3}
      set P/T [+1/+1]
        setCardAttr {zone:table,cardId:10,attribute:5,attrValue:3/3}
      set annotation [new note]
        setCardAttr {zone:table,cardId:10,attribute:6,attrValue:new note}
      set a card counter [4]
        bulkSetCardCounterEntries [{ownerPlayerId:1,zone:table,cardId:10,counterId:1,counterValue:4}]
      draw cards [9]
        drawCards {number:6}
      view top cards [3]
        dumpZone {playerId:1,zoneName:deck,numberCards:3,isReversed:false}
      reveal top cards to a player [2]
        revealCards {zoneName:deck,topCards:2,cardId:[0],playerId:2}
      shuffle top cards [4]
        shuffle {zoneName:deck,start:0,end:3}
      move a card X from the top [99]
        moveCard 
          startPlayerId: 1
          startZone: table
          cardsToMove: {card:[{cardId:10}]}
          targetPlayerId: 1
          targetZone: deck
          x: 6
          y: 0
          isReversed: false
      "
    `);
  });
});

describe('seat create-token dialog', () => {
  function tokenDialog() {
    return screen.getByRole('dialog', { name: /^create token$/i });
  }

  function nameInput(dialog: HTMLElement) {
    return within(dialog).queryByLabelText('Token name') ?? within(dialog).getByLabelText('Name');
  }

  function createToken(name: string) {
    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Create token...');
    const dialog = tokenDialog();
    fireEvent.change(nameInput(dialog), { target: { value: name } });
    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Common.action.create' }));
    });
  }

  it('creates the token on the local battlefield and closes', async () => {
    const game = renderSeats();

    createToken('Goblin');
    await act(async () => {});

    expect(screen.queryByRole('dialog', { name: /^create token$/i })).not.toBeInTheDocument();
    expect(wire(game)).toMatchInlineSnapshot(`
      [
        "createToken 
          zone: table
          cardName: Goblin
          cardProviderId: 
          color: w
          pt: 
          annotation: 
          destroyOnZoneChange: true
          faceDown: false
          x: -1
          y: 1",
      ]
    `);
  });

  it('refuses a blank name and sends nothing on cancel', async () => {
    const game = renderSeats();
    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Create token...');
    act(() => {
      fireEvent.submit(nameInput(tokenDialog()).closest('form')!);
    });
    expect(tokenDialog()).toBeInTheDocument();

    fireEvent.click(within(tokenDialog()).getByRole('button', { name: 'Common.action.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^create token$/i })).not.toBeInTheDocument());
    expect(wire(game)).toEqual([]);
  });

  it('reopens on the last token, and "Create another token" repeats it', async () => {
    const game = renderSeats();
    createToken('Soldier');
    await act(async () => {});

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Create token...');
    expect(nameInput(tokenDialog())).toHaveValue('Soldier');
    fireEvent.click(within(tokenDialog()).getByRole('button', { name: 'Common.action.cancel' }));

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Create another token');
    await act(async () => {});

    expect(wire(game).filter((c) => c.startsWith('createToken'))).toHaveLength(2);
    expect(wire(game)[1]).toBe(wire(game)[0]);
  });
});

