
import { act, fireEvent, screen, within } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';
import type { MoveCardParams } from '@cockatrice/sockatrice/generated';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import {
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

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 1,
  seats: [
    {
      playerId: 1,
      table: [makeCard({ id: 10, name: 'Bolt', x: 3, y: 1 })],
      stack: [makeCard({ id: 50, name: 'Counterspell' })],
      grave: [makeCard({ id: 40, name: 'Duress' }), makeCard({ id: 43, name: 'Opt' })],
      exile: [makeCard({ id: 42, name: 'Rest' })],
      hand: [makeCard({ id: 30, name: 'Shock' }), makeCard({ id: 31, name: 'Ponder' })],
      deckCount: 40,
    },
    { playerId: 2, handCount: 5, deckCount: 33 },
  ],
};

type Target = () => Element;
const BATTLEFIELD: Target = () => cardEl(10, 'battlefield');
const STACK: Target = () => cardEl(50, 'stack');
const LIBRARY: Target = () => pileEl('Library', 0);
const GRAVEYARD: Target = () => pileEl('Graveyard', 0);
const EXILE: Target = () => pileEl('Exile', 0);
const HAND: Target = () => pileEl('Hand', 0);

function answerPrompt(value: string) {
  const dialog = screen.getAllByRole('dialog').at(-1)!;
  const input = within(dialog).queryByRole('spinbutton') ?? within(dialog).getByRole('textbox');
  fireEvent.change(input, { target: { value } });
  act(() => {
    fireEvent.submit(input.closest('form')!);
  });
}

function movesFor(target: Target, path: string[], promptValue?: string): string[] {
  const webClient = createMockWebClient();
  const { unmount } = renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient });
  openContextMenu(target());
  chooseMenuPath(...path);
  if (promptValue != null) {
    answerPrompt(promptValue);
  }
  const calls = vi.mocked(webClient.request.game.moveCard).mock.calls;
  unmount();
  return calls.map(([, params, ...extra]) => formatMove(params, extra));
}

function formatMove(params: MoveCardParams, extra: unknown[]): string {
  const { startPlayerId, startZone, cardsToMove, targetPlayerId, targetZone, ...position } = params;
  const cards = (cardsToMove?.card ?? []).map(({ cardId, faceDown, ...other }) =>
    `${cardId}${faceDown ? '/fd' : ''}${Object.keys(other).length ? JSON.stringify(other) : ''}`);
  const tail = extra.some((e) => e != null) ? ` + ${JSON.stringify(extra)}` : '';
  return `P${startPlayerId} ${startZone} [${cards.join(', ')}] → P${targetPlayerId} ${targetZone} ${JSON.stringify(position)}${tail}`;
}

function log(cases: Array<[Target, string[], string?]>): string {
  return `\n${cases.map(([target, path, prompt]) =>
    `${path.join(' > ')}${prompt ? ` [${prompt}]` : ''}\n${movesFor(target, path, prompt).map((m) => `  ${m}`).join('\n')}`,
  ).join('\n')}\n`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seat menu moves on the wire', () => {
  it('battlefield card menu', () => {
    expect(log([
      [BATTLEFIELD, ['Move to', 'Top of library in random order']],
      [BATTLEFIELD, ['Move to', 'Bottom of library in random order']],
      [BATTLEFIELD, ['Move to', 'X cards from the top of library...'], '3'],
      [BATTLEFIELD, ['Move to', 'Table']],
      [BATTLEFIELD, ['Move to', 'Hand']],
      [BATTLEFIELD, ['Move to', 'Graveyard']],
      [BATTLEFIELD, ['Move to', 'Exile']],
    ])).toMatchInlineSnapshot(`
      "
      Move to > Top of library in random order
        P1 table [10] → P1 deck {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Bottom of library in random order
        P1 table [10] → P1 deck {"x":0,"y":0,"isReversed":true} + [null,{}]
      Move to > X cards from the top of library... [3]
        P1 table [10] → P1 deck {"x":2,"y":0,"isReversed":false} + [null,{}]
      Move to > Table
        P1 table [10] → P1 table {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Hand
        P1 table [10] → P1 hand {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Graveyard
        P1 table [10] → P1 grave {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Exile
        P1 table [10] → P1 rfg {"x":0,"y":0,"isReversed":false} + [null,{}]
      "
    `);
  });

  it('stack card menu', () => {
    expect(log([
      [STACK, ['Play']],
      [STACK, ['Play Face Down']],
      [STACK, ['Move to', 'Hand']],
      [STACK, ['Move to', 'Table']],
      [STACK, ['Move to', 'Graveyard']],
      [STACK, ['Move to', 'Exile']],
      [STACK, ['Move to', 'Top of library']],
      [STACK, ['Move to', 'Bottom of library']],
    ])).toMatchInlineSnapshot(`
      "
      Play
        P1 stack [50] → P1 table {"x":-1,"y":0,"isReversed":false} + [null,{}]
      Play Face Down
        P1 stack [50/fd] → P1 table {"x":-1,"y":0} + [null,{}]
      Move to > Hand
        P1 stack [50] → P1 hand {"x":-1,"y":0,"isReversed":false} + [null,{}]
      Move to > Table
        P1 stack [50] → P1 table {"x":-1,"y":0,"isReversed":false} + [null,{}]
      Move to > Graveyard
        P1 stack [50] → P1 grave {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Exile
        P1 stack [50] → P1 rfg {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Top of library
        P1 stack [50] → P1 deck {"x":0,"y":0,"isReversed":false} + [null,{}]
      Move to > Bottom of library
        P1 stack [50] → P1 deck {"x":-1,"y":0,"isReversed":false} + [null,{}]
      "
    `);
  });

  it('library menu, top of library', () => {
    expect(log([
      [LIBRARY, ['Top of library...', 'Play top card']],
      [LIBRARY, ['Top of library...', 'Play top card face down']],
      [LIBRARY, ['Top of library...', 'Put top card on bottom']],
      [LIBRARY, ['Top of library...', 'Move top card to graveyard']],
      [LIBRARY, ['Top of library...', 'Move top cards to graveyard...'], '2'],
      [LIBRARY, ['Top of library...', 'Move top cards to graveyard face down...'], '2'],
      [LIBRARY, ['Top of library...', 'Move top card to exile']],
      [LIBRARY, ['Top of library...', 'Move top cards to exile...'], '2'],
      [LIBRARY, ['Top of library...', 'Move top cards to exile face down...'], '2'],
    ])).toMatchInlineSnapshot(`
      "
      Top of library... > Play top card
        P1 deck [0] → P1 stack {"x":-1,"y":0}
      Top of library... > Play top card face down
        P1 deck [0/fd] → P1 table {"x":-1,"y":0}
      Top of library... > Put top card on bottom
        P1 deck [0] → P1 deck {"x":-1,"y":0}
      Top of library... > Move top card to graveyard
        P1 deck [0] → P1 grave {"x":0,"y":0}
      Top of library... > Move top cards to graveyard... [2]
        P1 deck [1, 0] → P1 grave {"x":0,"y":0}
      Top of library... > Move top cards to graveyard face down... [2]
        P1 deck [1/fd, 0/fd] → P1 grave {"x":0,"y":0}
      Top of library... > Move top card to exile
        P1 deck [0] → P1 rfg {"x":0,"y":0}
      Top of library... > Move top cards to exile... [2]
        P1 deck [1, 0] → P1 rfg {"x":0,"y":0}
      Top of library... > Move top cards to exile face down... [2]
        P1 deck [1/fd, 0/fd] → P1 rfg {"x":0,"y":0}
      "
    `);
  });

  it('library menu, bottom of library', () => {
    expect(log([
      [LIBRARY, ['Bottom of library...', 'Draw bottom card']],
      [LIBRARY, ['Bottom of library...', 'Draw bottom cards...'], '2'],
      [LIBRARY, ['Bottom of library...', 'Play bottom card']],
      [LIBRARY, ['Bottom of library...', 'Play bottom card face down']],
      [LIBRARY, ['Bottom of library...', 'Put bottom card on top']],
      [LIBRARY, ['Bottom of library...', 'Move bottom card to graveyard']],
      [LIBRARY, ['Bottom of library...', 'Move bottom cards to graveyard...'], '2'],
      [LIBRARY, ['Bottom of library...', 'Move bottom cards to graveyard face down...'], '2'],
      [LIBRARY, ['Bottom of library...', 'Move bottom card to exile']],
      [LIBRARY, ['Bottom of library...', 'Move bottom cards to exile...'], '2'],
      [LIBRARY, ['Bottom of library...', 'Move bottom cards to exile face down...'], '2'],
    ])).toMatchInlineSnapshot(`
      "
      Bottom of library... > Draw bottom card
        P1 deck [39] → P1 hand {"x":0,"y":0}
      Bottom of library... > Draw bottom cards... [2]
        P1 deck [38, 39] → P1 hand {"x":0,"y":0}
      Bottom of library... > Play bottom card
        P1 deck [39] → P1 stack {"x":-1,"y":0}
      Bottom of library... > Play bottom card face down
        P1 deck [39/fd] → P1 table {"x":-1,"y":0}
      Bottom of library... > Put bottom card on top
        P1 deck [39] → P1 deck {"x":0,"y":0}
      Bottom of library... > Move bottom card to graveyard
        P1 deck [39] → P1 grave {"x":0,"y":0}
      Bottom of library... > Move bottom cards to graveyard... [2]
        P1 deck [38, 39] → P1 grave {"x":0,"y":0}
      Bottom of library... > Move bottom cards to graveyard face down... [2]
        P1 deck [38/fd, 39/fd] → P1 grave {"x":0,"y":0}
      Bottom of library... > Move bottom card to exile
        P1 deck [39] → P1 rfg {"x":0,"y":0}
      Bottom of library... > Move bottom cards to exile... [2]
        P1 deck [38, 39] → P1 rfg {"x":0,"y":0}
      Bottom of library... > Move bottom cards to exile face down... [2]
        P1 deck [38/fd, 39/fd] → P1 rfg {"x":0,"y":0}
      "
    `);
  });

  it('graveyard, exile and hand menus', () => {
    expect(log([
      [GRAVEYARD, ['Move graveyard to...', 'Top of library']],
      [GRAVEYARD, ['Move graveyard to...', 'Bottom of library']],
      [GRAVEYARD, ['Move graveyard to...', 'Hand']],
      [GRAVEYARD, ['Move graveyard to...', 'Exile']],
      [EXILE, ['Move exile to...', 'Top of library']],
      [EXILE, ['Move exile to...', 'Graveyard']],
      [HAND, ['Move hand to...', 'Top of library']],
      [HAND, ['Move hand to...', 'Bottom of library']],
      [HAND, ['Move hand to...', 'Graveyard']],
      [HAND, ['Move hand to...', 'Exile']],
    ])).toMatchInlineSnapshot(`
      "
      Move graveyard to... > Top of library
        P1 grave [40, 43] → P1 deck {"x":0,"y":0}
      Move graveyard to... > Bottom of library
        P1 grave [40, 43] → P1 deck {"x":-1,"y":0}
      Move graveyard to... > Hand
        P1 grave [40, 43] → P1 hand {"x":0,"y":0}
      Move graveyard to... > Exile
        P1 grave [40, 43] → P1 rfg {"x":0,"y":0}
      Move exile to... > Top of library
        P1 rfg [42] → P1 deck {"x":0,"y":0} + [null,{}]
      Move exile to... > Graveyard
        P1 rfg [42] → P1 grave {"x":0,"y":0} + [null,{}]
      Move hand to... > Top of library
        P1 hand [30, 31] → P1 deck {"x":0,"y":0}
      Move hand to... > Bottom of library
        P1 hand [30, 31] → P1 deck {"x":-1,"y":0}
      Move hand to... > Graveyard
        P1 hand [30, 31] → P1 grave {"x":0,"y":0}
      Move hand to... > Exile
        P1 hand [30, 31] → P1 rfg {"x":0,"y":0}
      "
    `);
  });
});
