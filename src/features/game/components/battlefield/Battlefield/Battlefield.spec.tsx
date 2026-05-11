import { create } from '@bufbuild/protobuf';
import { act, screen } from '@testing-library/react';
import { App, Data } from '@app/types';

vi.mock('../../../../../hooks/useSettings');

import { useSettings } from '../../../../../hooks/useSettings';
import { makeSettings, makeSettingsHook } from '../../../../../hooks/__mocks__/useSettings';
import { makeStoreState, renderWithProviders } from '../../../../../__test-utils__';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makeZoneEntry,
} from '../../../../../store/game/__mocks__/fixtures';
import { Actions } from '../../../../../store/game/game.actions';
import Battlefield from './Battlefield';

function setInvert(invert: boolean) {
  vi.mocked(useSettings).mockReturnValue(
    makeSettingsHook({ value: makeSettings({ invertVerticalCoordinate: invert }) }),
  );
}

function stateWithBattlefield(cards: ReturnType<typeof makeCard>[]) {
  const table = makeZoneEntry({
    name: App.ZoneName.TABLE,
    type: 1,
    withCoords: true,
    cardCount: cards.length,
    cards,
  });
  const player = makePlayerEntry({
    zones: { [App.ZoneName.TABLE]: table },
  });
  const game = makeGameEntry({
    localPlayerId: 1,
    players: { 1: player },
  });
  return makeStoreState({ games: { games: { 1: game } } });
}

function stateWithTwoBattlefields(
  player1Cards: ReturnType<typeof makeCard>[],
  player2Cards: ReturnType<typeof makeCard>[],
) {
  const buildPlayer = (cards: ReturnType<typeof makeCard>[]) =>
    makePlayerEntry({
      zones: {
        [App.ZoneName.TABLE]: makeZoneEntry({
          name: App.ZoneName.TABLE,
          type: 1,
          withCoords: true,
          cardCount: cards.length,
          cards,
        }),
      },
    });
  const game = makeGameEntry({
    localPlayerId: 1,
    players: { 1: buildPlayer(player1Cards), 2: buildPlayer(player2Cards) },
  });
  return makeStoreState({ games: { games: { 1: game } } });
}

describe('Battlefield', () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook());
  });

  it('renders three rows regardless of card count', () => {
    renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
      preloadedState: stateWithBattlefield([]),
    });

    expect(screen.getByTestId('battlefield-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('battlefield-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('battlefield-row-2')).toBeInTheDocument();
  });

  it('places cards into rows by y coordinate', () => {
    const cards = [
      makeCard({ id: 1, name: 'Top', x: 0, y: 0 }),
      makeCard({ id: 2, name: 'Mid', x: 0, y: 1 }),
      makeCard({ id: 3, name: 'Bot', x: 0, y: 2 }),
    ];
    renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
      preloadedState: stateWithBattlefield(cards),
    });

    expect(screen.getByTestId('battlefield-row-0').querySelector('img')?.alt).toBe('Top');
    expect(screen.getByTestId('battlefield-row-1').querySelector('img')?.alt).toBe('Mid');
    expect(screen.getByTestId('battlefield-row-2').querySelector('img')?.alt).toBe('Bot');
  });

  it('clamps out-of-range y values into the three-row space', () => {
    const cards = [
      makeCard({ id: 1, name: 'TooHigh', x: 0, y: -5 }),
      makeCard({ id: 2, name: 'TooLow', x: 0, y: 99 }),
    ];
    renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
      preloadedState: stateWithBattlefield(cards),
    });

    expect(screen.getByTestId('battlefield-row-0').querySelector('img')?.alt).toBe('TooHigh');
    expect(screen.getByTestId('battlefield-row-2').querySelector('img')?.alt).toBe('TooLow');
  });

  it('sorts cards within a row by x coordinate', () => {
    const cards = [
      makeCard({ id: 1, name: 'Right', x: 10, y: 0 }),
      makeCard({ id: 2, name: 'Left', x: 0, y: 0 }),
    ];
    renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
      preloadedState: stateWithBattlefield(cards),
    });

    const row0 = screen.getByTestId('battlefield-row-0');
    const imgs = Array.from(row0.querySelectorAll('img'));
    expect(imgs.map((i) => i.alt)).toEqual(['Left', 'Right']);
  });

  it('renders rows top-to-bottom as 0,1,2 when not mirrored', () => {
    const cards = [
      makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
      makeCard({ id: 2, name: 'B', x: 0, y: 1 }),
      makeCard({ id: 3, name: 'C', x: 0, y: 2 }),
    ];
    renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
      preloadedState: stateWithBattlefield(cards),
    });

    const rowsInOrder = Array.from(
      screen.getByTestId('battlefield').querySelectorAll('.battlefield__row'),
    );
    expect(rowsInOrder.map((r) => r.getAttribute('data-row'))).toEqual(['0', '1', '2']);
  });

  it('renders rows bottom-to-top as 2,1,0 when mirrored (opponent)', () => {
    const cards = [
      makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
      makeCard({ id: 2, name: 'B', x: 0, y: 1 }),
      makeCard({ id: 3, name: 'C', x: 0, y: 2 }),
    ];
    renderWithProviders(<Battlefield gameId={1} playerId={1} mirrored />, {
      preloadedState: stateWithBattlefield(cards),
    });

    const rowsInOrder = Array.from(
      screen.getByTestId('battlefield').querySelectorAll('.battlefield__row'),
    );
    expect(rowsInOrder.map((r) => r.getAttribute('data-row'))).toEqual(['2', '1', '0']);
  });

  describe('invertVerticalCoordinate user setting', () => {
    it('renders rows bottom-to-top when the setting is on and not mirrored (local player)', () => {
      setInvert(true);
      const cards = [
        makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'B', x: 0, y: 1 }),
        makeCard({ id: 3, name: 'C', x: 0, y: 2 }),
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
        preloadedState: stateWithBattlefield(cards),
      });

      const rowsInOrder = Array.from(
        screen.getByTestId('battlefield').querySelectorAll('.battlefield__row'),
      );
      expect(rowsInOrder.map((r) => r.getAttribute('data-row'))).toEqual(['2', '1', '0']);
    });

    it('restores top-to-bottom ordering when setting is on AND mirrored (XOR cancels)', () => {
      setInvert(true);
      const cards = [
        makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'B', x: 0, y: 1 }),
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} mirrored />, {
        preloadedState: stateWithBattlefield(cards),
      });

      const rowsInOrder = Array.from(
        screen.getByTestId('battlefield').querySelectorAll('.battlefield__row'),
      );
      expect(rowsInOrder.map((r) => r.getAttribute('data-row'))).toEqual(['0', '1', '2']);
    });

  });

  describe('attachments', () => {
    function attachedChild(overrides: Parameters<typeof makeCard>[0]) {
      return makeCard({
        attachPlayerId: 1,
        attachZone: App.ZoneName.TABLE,
        ...overrides,
      });
    }

    it('renders attached children inside the parent stack, not as independent lane slots', () => {
      const cards = [
        makeCard({ id: 10, name: 'Creature', x: 0, y: 0 }),
        attachedChild({ id: 11, name: 'Aura', x: 5, y: 2, attachCardId: 10 }),
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
        preloadedState: stateWithBattlefield(cards),
      });

      // Parent is in row 0; child is NOT bucketed into its own y=2 lane —
      // instead it lives inside the parent's AttachmentStack.
      const row0 = screen.getByTestId('battlefield-row-0');
      const row2 = screen.getByTestId('battlefield-row-2');
      expect(row0.querySelector('img[alt="Creature"]')).not.toBeNull();
      expect(row0.querySelector('img[alt="Aura"]')).not.toBeNull();
      expect(row2.querySelector('img[alt="Aura"]')).toBeNull();
    });

    it('fans attachments to the left of the parent (parent rightmost, on top)', () => {
      // Two attachments → stackFactor = 1 + 2/3 = 5/3. Card width = 60%.
      // Reversed fan (matches desktop): parent at left=40%, first-attached
      // child[0] just left of parent at 20%, second-attached child[1] at 0%.
      // z-order: parent=3 (top), child[0]=2, child[1]=1.
      // Children also sit slightly higher than parent (top ≈ 1.96%) so they
      // peek above the parent's top edge.
      const cards = [
        makeCard({ id: 1, name: 'Creature', x: 0, y: 0 }),
        attachedChild({ id: 2, name: 'AuraA', attachCardId: 1 }),
        attachedChild({ id: 3, name: 'AuraB', attachCardId: 1 }),
      ];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield(cards) },
      );

      const parent = container.querySelector(
        '.attachment-stack__parent',
      ) as HTMLElement;
      expect(parent.style.left).toBe('40%');
      expect(parent.style.width).toBe('60%');
      // parent top = 14 / 204 ≈ 6.86%
      expect(parent.style.top).toBe('6.86%');
      expect(parent.style.zIndex).toBe('3');

      const children = Array.from(
        container.querySelectorAll('.attachment-stack__child'),
      ) as HTMLElement[];
      expect(children).toHaveLength(2);
      expect(children[0].style.left).toBe('20%');
      expect(children[0].style.width).toBe('60%');
      // child top = 6 / 204 ≈ 2.94%
      expect(children[0].style.top).toBe('2.94%');
      expect(children[0].style.zIndex).toBe('2');
      expect(children[1].style.left).toBe('0%');
      expect(children[1].style.width).toBe('60%');
      expect(children[1].style.top).toBe('2.94%');
      expect(children[1].style.zIndex).toBe('1');
    });

    it('does not flip the stack direction on an inverted (opponent) board', () => {
      const cards = [
        makeCard({ id: 1, name: 'Creature', x: 0, y: 0 }),
        attachedChild({ id: 2, name: 'Aura', attachCardId: 1 }),
      ];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} mirrored />,
        { preloadedState: stateWithBattlefield(cards) },
      );

      // One attachment → stackFactor = 4/3. Reversed fan keeps the child at
      // left=0 (leftmost) and parent at left=25% (rightmost), regardless of
      // board mirror state.
      const child = container.querySelector('.attachment-stack__child') as HTMLElement;
      expect(child.style.left).toBe('0%');
      const parent = container.querySelector(
        '.attachment-stack__parent',
      ) as HTMLElement;
      expect(parent.style.left).toBe('25%');
    });

    it('omits the parent Y offset when the card has no attachments', () => {
      // Standalone card (N=0): parentTopPct must be 0 so cards on the table
      // without attachments stay vertically centered in their lane. Mirrors
      // desktop's `if (numberAttachedCards) actualY += 15` guard.
      const cards = [makeCard({ id: 1, name: 'Solo', x: 0, y: 0 })];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield(cards) },
      );

      const parent = container.querySelector(
        '.attachment-stack__parent',
      ) as HTMLElement;
      expect(parent.style.top).toBe('0%');
      expect(parent.style.left).toBe('0%');
      expect(parent.style.width).toBe('100%');
    });

    it('sizes the outer stack column to accommodate the full attachment footprint', () => {
      // Two attachments → stackFactor 5/3; width footprint = 146 × 5/3 ≈ 243.33.
      // Height footprint = 204 + 14 (parent Y offset, since N > 0) = 218.
      // Stack column aspect-ratio = 243.33 / 218.
      const cards = [
        makeCard({ id: 1, name: 'Creature', x: 0, y: 0 }),
        attachedChild({ id: 2, name: 'AuraA', attachCardId: 1 }),
        attachedChild({ id: 3, name: 'AuraB', attachCardId: 1 }),
      ];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield(cards) },
      );

      const stackColumn = container.querySelector(
        '.battlefield-stack-column',
      ) as HTMLElement;
      expect(stackColumn.style.aspectRatio).toBe('243.33 / 218');
    });

    it('attached children render with the card-slot testid so they remain interactive', () => {
      const cards = [
        makeCard({ id: 1, name: 'Creature', x: 0, y: 0 }),
        attachedChild({ id: 2, name: 'Aura', attachCardId: 1 }),
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
        preloadedState: stateWithBattlefield(cards),
      });

      const slots = screen.getAllByTestId('card-slot');
      expect(slots).toHaveLength(2);
      expect(slots.map((s) => s.getAttribute('data-card-id'))).toEqual(['1', '2']);
    });

    it('renders a cross-player attachment under the parent\'s battlefield', () => {
      // Servatrice keeps the aura in its original owner's zone (player 1)
      // but parent-points it at player 2's creature. Cockatrice paints the
      // aura under the parent's zone via attachedTo->getZone()->reorganize.
      // The webclient must do the same — when rendering player 2's
      // battlefield, the aura should appear nested under their creature even
      // though it lives in player 1's TABLE zone.
      const ownersAura = makeCard({
        id: 11, name: 'Cross-player aura', x: 3, y: 0,
        attachPlayerId: 2, attachZone: App.ZoneName.TABLE, attachCardId: 21,
      });
      const enemyCreature = makeCard({ id: 21, name: 'Enemy creature', x: 0, y: 0 });

      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={2} mirrored />,
        { preloadedState: stateWithTwoBattlefields([ownersAura], [enemyCreature]) },
      );

      // The aura must render as a child inside player 2's AttachmentStack…
      const children = container.querySelectorAll('.attachment-stack__child');
      expect(children).toHaveLength(1);
      expect(children[0].querySelector('img')?.alt).toBe('Cross-player aura');
      // …with its CardSlot tagged with the actual owner (player 1), so
      // click/drag handlers downstream act on the correct player's card.
      const childSlot = children[0].querySelector('[data-testid="card-slot"]') as HTMLElement;
      expect(childSlot.getAttribute('data-card-owner')).toBe('1');
      // The parent's slot stays tagged with player 2.
      const parentSlot = container.querySelector(
        '.attachment-stack__parent [data-testid="card-slot"]',
      ) as HTMLElement;
      expect(parentSlot.getAttribute('data-card-owner')).toBe('2');
    });

    it('keeps auras under the parent when the parent moves cross-player (table→table)', () => {
      // Servatrice doesn't emit unattach events for auras when their parent
      // moves between players' tables (server_abstract_player.cpp:376 only
      // unattaches on cross-zone-NAME moves, not cross-player). It also
      // reassigns the parent's id on cross-player move (line 449). Cockatrice
      // desktop survives via Qt pointer-linkage; we survive by rewriting
      // each child's (attachPlayerId, attachCardId) in the cardMoved
      // reducer. Pin the end-to-end behavior here.
      const parent = makeCard({ id: 10, name: 'Creature', x: 0, y: 0 });
      const auraA = makeCard({
        id: 11, name: 'AuraA', x: 1, y: 0,
        attachPlayerId: 1, attachZone: App.ZoneName.TABLE, attachCardId: 10,
      });
      const auraB = makeCard({
        id: 12, name: 'AuraB', x: 2, y: 0,
        attachPlayerId: 1, attachZone: App.ZoneName.TABLE, attachCardId: 10,
      });
      const { store, container } = renderWithProviders(
        <Battlefield gameId={1} playerId={2} mirrored />,
        { preloadedState: stateWithTwoBattlefields([parent, auraA, auraB], []) },
      );

      // Before the move, player 2's battlefield is empty.
      expect(container.querySelectorAll('.attachment-stack__parent')).toHaveLength(0);

      act(() => {
        store.dispatch(
          Actions.cardMoved({
            gameId: 1,
            playerId: 1,
            data: create(Data.Event_MoveCardSchema, {
              cardId: 10, cardName: '', startPlayerId: 1, startZone: App.ZoneName.TABLE,
              position: -1, targetPlayerId: 2, targetZone: App.ZoneName.TABLE,
              x: 0, y: 0, newCardId: 99, faceDown: false, newCardProviderId: '',
            }),
          }),
        );
      });

      // After the move, the parent renders on player 2's battlefield with
      // both auras nested inside its AttachmentStack.
      const parentSlot = container.querySelector(
        '.attachment-stack__parent img',
      ) as HTMLImageElement;
      expect(parentSlot?.alt).toBe('Creature');
      const childImgs = Array.from(
        container.querySelectorAll('.attachment-stack__child img'),
      ) as HTMLImageElement[];
      expect(childImgs.map((i) => i.alt).sort()).toEqual(['AuraA', 'AuraB']);
    });

    it('re-renders when a card becomes attached via cardAttached dispatch', () => {
      // Regression: after right-click → "Attach to card…" → click target,
      // the source card was visually staying as a standalone in its lane
      // until any subsequent action triggered another render. The dispatch
      // path itself is fine — this test pins the dispatch → DOM update so
      // any future selector-cache or memoization regression surfaces here.
      const parent = makeCard({ id: 10, name: 'Creature', x: 0, y: 0 });
      const source = makeCard({ id: 11, name: 'Aura', x: 3, y: 0 });
      const { store, container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield([parent, source]) },
      );

      const row0Before = screen.getByTestId('battlefield-row-0');
      expect(
        row0Before.querySelectorAll('[data-testid="battlefield-stack-column"]'),
      ).toHaveLength(2);
      expect(container.querySelectorAll('.attachment-stack__child')).toHaveLength(0);

      act(() => {
        store.dispatch(
          Actions.cardAttached({
            gameId: 1,
            playerId: 1,
            data: create(Data.Event_AttachCardSchema, {
              startZone: App.ZoneName.TABLE,
              cardId: 11,
              targetPlayerId: 1,
              targetZone: App.ZoneName.TABLE,
              targetCardId: 10,
            }),
          }),
        );
      });

      const row0After = screen.getByTestId('battlefield-row-0');
      expect(
        row0After.querySelectorAll('[data-testid="battlefield-stack-column"]'),
      ).toHaveLength(1);
      const children = container.querySelectorAll('.attachment-stack__child');
      expect(children).toHaveLength(1);
      expect(children[0].querySelector('img')?.getAttribute('alt')).toBe('Aura');
    });
  });

  describe('stack columns (desktop-parity x packing)', () => {
    it('packs 3 cards at x=0,1,2 into a single stack column at sub-positions 0/1/2', () => {
      const cards = [
        makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'B', x: 1, y: 0 }),
        makeCard({ id: 3, name: 'C', x: 2, y: 0 }),
      ];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield(cards) },
      );

      const row0 = screen.getByTestId('battlefield-row-0');
      const stacks = row0.querySelectorAll('[data-testid="battlefield-stack-column"]');
      expect(stacks).toHaveLength(1);

      const slots = Array.from(
        stacks[0].querySelectorAll('.battlefield-stack-column__slot'),
      ) as HTMLElement[];
      expect(slots).toHaveLength(3);
      // Positions are expressed as percentages of the stack column footprint
      // (width 244, height 228 for a 3-card stack with 12px stair-step) so
      // they scale with lane height. 49/244 ≈ 20.08%; 98/244 ≈ 40.16%; 12/228
      // ≈ 5.26%; 24/228 ≈ 10.53%.
      expect(slots[0].style.left).toBe('0%');
      expect(slots[1].style.left).toBe('20.08%');
      expect(slots[2].style.left).toBe('40.16%');
      expect(slots[0].style.top).toBe('0%');
      expect(slots[1].style.top).toBe('5.26%');
      expect(slots[2].style.top).toBe('10.53%');
      expect(slots[0].style.zIndex).toBe('1');
      expect(slots[2].style.zIndex).toBe('3');
      // containerize sanity: the stack column width accommodates 3 cards.
      void container;
    });

    it('splits a 4th card into a new stack column at sub-position 0', () => {
      const cards = [
        makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'B', x: 1, y: 0 }),
        makeCard({ id: 3, name: 'C', x: 2, y: 0 }),
        makeCard({ id: 4, name: 'D', x: 3, y: 0 }), // starts a new stack (col 1)
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
        preloadedState: stateWithBattlefield(cards),
      });

      const row0 = screen.getByTestId('battlefield-row-0');
      const stacks = row0.querySelectorAll('[data-testid="battlefield-stack-column"]');
      expect(stacks).toHaveLength(2);
      expect(stacks[0].querySelectorAll('img').length).toBe(3);
      expect(stacks[1].querySelectorAll('img').length).toBe(1);
    });

    it('sizes a single-card stack with aspect-ratio 146/204 so it scales with lane height', () => {
      const cards = [makeCard({ id: 1, name: 'Alone', x: 0, y: 0 })];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield(cards) },
      );
      const stack = container.querySelector('.battlefield-stack-column') as HTMLElement;
      expect(stack.style.aspectRatio).toBe('146 / 204');
    });

    it('sizes a 3-card stack to fit both the rightmost sub-position and the diagonal pile (aspect-ratio 244/228)', () => {
      // Width: 146 + 2 × 49 = 244. Height: 204 + 2 × 12 = 228 (each subPos
      // shifts down by STACKED_CARD_OFFSET_Y_PX so a 3-card pile bulges 24px).
      const cards = [
        makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'B', x: 1, y: 0 }),
        makeCard({ id: 3, name: 'C', x: 2, y: 0 }),
      ];
      const { container } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield(cards) },
      );
      const stack = container.querySelector('.battlefield-stack-column') as HTMLElement;
      expect(stack.style.aspectRatio).toBe('244 / 228');
    });

    it('preserves empty stack columns so a card at gridX=7 renders at visual column 2', () => {
      // Cards at gridX 0 and 7 → stack cols 0 and 2 (col 1 empty). The empty
      // col 1 is rendered as a placeholder spacer so the visual positions
      // match the stored x values; without it, a card dropped at gridX=7 in
      // an otherwise-empty row would pack to visual column 0.
      const cards = [
        makeCard({ id: 1, name: 'Far-left', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'Far-right', x: 7, y: 0 }),
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
        preloadedState: stateWithBattlefield(cards),
      });

      const row0 = screen.getByTestId('battlefield-row-0');
      const stacks = row0.querySelectorAll('[data-testid="battlefield-stack-column"]');
      const placeholders = row0.querySelectorAll(
        '[data-testid="battlefield-stack-placeholder"]',
      );
      expect(stacks).toHaveLength(2);
      expect(placeholders).toHaveLength(1);
      // Verify rendering order: stack(col0), placeholder(col1), stack(col2).
      const items = Array.from(
        row0.querySelectorAll(
          '[data-testid="battlefield-stack-column"], [data-testid="battlefield-stack-placeholder"]',
        ),
      );
      expect(items[0].getAttribute('data-testid')).toBe('battlefield-stack-column');
      expect(items[1].getAttribute('data-testid')).toBe('battlefield-stack-placeholder');
      expect(items[1].getAttribute('data-col')).toBe('1');
      expect(items[2].getAttribute('data-testid')).toBe('battlefield-stack-column');
    });

    it('renders no placeholders for a row packed from column 0', () => {
      const cards = [
        makeCard({ id: 1, name: 'A', x: 0, y: 0 }),
        makeCard({ id: 2, name: 'B', x: 3, y: 0 }),
      ];
      renderWithProviders(<Battlefield gameId={1} playerId={1} />, {
        preloadedState: stateWithBattlefield(cards),
      });

      expect(
        screen
          .getByTestId('battlefield-row-0')
          .querySelectorAll('[data-testid="battlefield-stack-placeholder"]'),
      ).toHaveLength(0);
    });

    it('re-renders when a card is moved between columns in the same row', () => {
      const mover = makeCard({ id: 50, name: 'Mover', x: 0, y: 0 });
      const stationary = makeCard({ id: 51, name: 'Still', x: 6, y: 0 });
      const { store } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield([mover, stationary]) },
      );

      const row0 = screen.getByTestId('battlefield-row-0');
      // Before: Mover at col 0, placeholder at col 1, Still at col 2.
      expect(row0.querySelectorAll('[data-testid="battlefield-stack-column"]')).toHaveLength(2);
      expect(row0.querySelectorAll('[data-testid="battlefield-stack-placeholder"]')).toHaveLength(1);

      act(() => {
        store.dispatch(
          Actions.cardMoved({
            gameId: 1,
            playerId: 1,
            data: create(Data.Event_MoveCardSchema, {
              cardId: 50, cardName: '', startPlayerId: 1,
              startZone: App.ZoneName.TABLE, position: -1,
              targetPlayerId: 1, targetZone: App.ZoneName.TABLE,
              x: 3, y: 0, // Move Mover from col 0 to col 1, same row
              newCardId: -1, faceDown: false, newCardProviderId: '',
            }),
          }),
        );
      });

      // After: placeholder at col 0, Mover at col 1, Still at col 2 — no
      // placeholder between them since col 1 is now occupied.
      const row0After = screen.getByTestId('battlefield-row-0');
      const items = Array.from(row0After.children);
      expect(items).toHaveLength(3);
      expect(items[0].getAttribute('data-testid')).toBe('battlefield-stack-placeholder');
      expect(items[1].getAttribute('data-testid')).toBe('battlefield-stack-column');
      expect(items[2].getAttribute('data-testid')).toBe('battlefield-stack-column');
      // Confirm identities: Mover in the middle stack, Still in the rightmost.
      expect(items[1].querySelector('img[alt="Mover"]')).not.toBeNull();
      expect(items[2].querySelector('img[alt="Still"]')).not.toBeNull();
    });

    it('re-renders when a card is moved intra-battlefield (Event_MoveCard arrives)', () => {
      const card = makeCard({ id: 42, name: 'Mover', x: 0, y: 0 });
      const { store } = renderWithProviders(
        <Battlefield gameId={1} playerId={1} />,
        { preloadedState: stateWithBattlefield([card]) },
      );

      // Before: card lives in row 0, stack col 0.
      expect(
        screen.getByTestId('battlefield-row-0').querySelector('img[alt="Mover"]'),
      ).not.toBeNull();
      expect(
        screen.getByTestId('battlefield-row-1').querySelector('img[alt="Mover"]'),
      ).toBeNull();

      act(() => {
        store.dispatch(
          Actions.cardMoved({
            gameId: 1,
            playerId: 1,
            data: create(Data.Event_MoveCardSchema, {
              cardId: 42,
              cardName: '',
              startPlayerId: 1,
              startZone: App.ZoneName.TABLE,
              position: -1,
              targetPlayerId: 1,
              targetZone: App.ZoneName.TABLE,
              x: 6,
              y: 1,
              newCardId: -1,
              faceDown: false,
              newCardProviderId: '',
            }),
          }),
        );
      });

      // After: row 0 empty; row 1 holds Mover at stack col 2 with two
      // placeholder spacers for cols 0/1.
      expect(
        screen.getByTestId('battlefield-row-0').querySelector('img[alt="Mover"]'),
      ).toBeNull();
      const row1 = screen.getByTestId('battlefield-row-1');
      expect(row1.querySelector('img[alt="Mover"]')).not.toBeNull();
      expect(
        row1.querySelectorAll('[data-testid="battlefield-stack-placeholder"]'),
      ).toHaveLength(2);
    });
  });
});
