import { ZoneName, type CardLocation } from '@cockatrice/sockatrice';
import { screen, fireEvent } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import {
  ServerInfo_Card,
  ServerInfo_CardCounterSchema,
} from '@cockatrice/sockatrice/generated';
import { createMockWebClient, makeStoreState, renderWithProviders } from '../../../../../__test-utils__';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';
import type { GameDialogs } from '../../../hooks/useGameDialogs';
import CardContextMenu from './CardContextMenu';

// CardContextMenu now self-sources: the right-clicked card / owner / zone come
// from dialogs.cardMenu (GameDialogsContext), localPlayerId from the store via
// useLocalIdentity, and the parent action handlers from the dialogs slice.
function renderMenu(opts: {
  card?: ServerInfo_Card | null;
  localPlayerId?: number;
  ownerPlayerId?: number;
  sourceZone?: string;
  dialogs?: Partial<GameDialogs>;
  webClient?: ReturnType<typeof createMockWebClient>;
} = {}) {
  const card = opts.card === undefined ? makeCard() : opts.card;
  const localPlayerId = opts.localPlayerId ?? 1;
  const ownerPlayerId = opts.ownerPlayerId ?? 1;
  const sourceZone = opts.sourceZone ?? ZoneName.TABLE;
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: localPlayerId }),
  });
  const preloadedState = makeStoreState({
    games: { games: { 1: makeGameEntry({ localPlayerId, players: { [localPlayerId]: player } }) } },
  });
  const cardMenu = card
    ? { card, sourcePlayerId: ownerPlayerId, sourceZone, anchorPosition: { top: 100, left: 100 } }
    : null;
  return renderWithProviders(<CardContextMenu />, {
    preloadedState,
    webClient: opts.webClient,
    gameDialogs: { cardMenu, ...opts.dialogs },
  });
}

// Card actions invoke the sockatrice bulk command surface (request.game.bulk*);
// here we assert the menu fired the right command for the right card. The
// command-building itself is covered by sockatrice's bulkCardActions.spec.
type BulkFn = 'bulkTap' | 'bulkFlip' | 'bulkDoesntUntap' | 'bulkPeek' | 'bulkMove';
function lastBulk(webClient: ReturnType<typeof createMockWebClient>, fn: BulkFn) {
  const calls = vi.mocked(webClient.request.game[fn] as (...a: unknown[]) => void).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1];
}
function targetIds(targets: readonly CardLocation[]): number[] {
  return targets.map((t) => t.card.id).sort((a, b) => a - b);
}

describe('CardContextMenu', () => {
  it('does not render when there is no open card menu', () => {
    const { container } = renderMenu({ card: null });
    expect(container.querySelector('[data-testid="card-context-menu"]')).toBeNull();
  });

  it('renders all expected menu items', () => {
    renderMenu({ card: makeCard({ tapped: false, faceDown: false }) });

    expect(screen.getByText('Tap')).toBeInTheDocument();
    expect(screen.getByText('Face Down')).toBeInTheDocument();
    expect(screen.getByText('Doesn\'t Untap')).toBeInTheDocument();
    expect(screen.getByText('Set P/T…')).toBeInTheDocument();
    expect(screen.getByText('Set Annotation…')).toBeInTheDocument();
    expect(screen.getByText('Counters')).toBeInTheDocument();
    expect(screen.getByText('Send to Hand')).toBeInTheDocument();
    expect(screen.getByText('Send to Graveyard')).toBeInTheDocument();
    expect(screen.getByText('Send to Exile')).toBeInTheDocument();
    expect(screen.getByText('Send to Library (top)')).toBeInTheDocument();
    expect(screen.getByText('Send to Library (bottom)')).toBeInTheDocument();
  });

  it('turns a face-up card face down via flipCard and closes the menu', () => {
    const webClient = createMockWebClient();
    const closeCardMenu = vi.fn();
    renderMenu({ card: makeCard({ id: 10, faceDown: false }), webClient, dialogs: { closeCardMenu } });

    fireEvent.click(screen.getByText('Face Down'));

    const [gameId, targets] = lastBulk(webClient, 'bulkFlip');
    expect(gameId).toBe(1);
    expect(targetIds(targets as CardLocation[])).toEqual([10]);
    expect(closeCardMenu).toHaveBeenCalled();
  });

  it('taps via bulkTap (Tap label when untapped)', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, tapped: false }), webClient });

    expect(screen.getByText('Tap')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tap'));

    expect(targetIds(lastBulk(webClient, 'bulkTap')[1] as CardLocation[])).toEqual([5]);
  });

  it('shows the Untap label and taps via bulkTap when the card is already tapped', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, tapped: true }), webClient });

    expect(screen.getByText('Untap')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Untap'));

    expect(targetIds(lastBulk(webClient, 'bulkTap')[1] as CardLocation[])).toEqual([5]);
  });

  // Face-up/down both route through bulkFlip (which uses Command_FlipCard, whose
  // event carries the revealed name/providerId — see sockatrice bulkCardActions).
  it('turns a face-down card face up via bulkFlip and shows the Face Up label', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, faceDown: true }), webClient });

    expect(screen.getByText('Face Up')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Face Up'));

    expect(targetIds(lastBulk(webClient, 'bulkFlip')[1] as CardLocation[])).toEqual([5]);
  });

  it('toggles Doesn\'t Untap via bulkDoesntUntap and shows Allow Untap when already set', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, doesntUntap: true }), webClient });

    expect(screen.getByText('Allow Untap')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Allow Untap'));

    expect(targetIds(lastBulk(webClient, 'bulkDoesntUntap')[1] as CardLocation[])).toEqual([5]);
  });

  it('requests the PT prompt via parent callback', () => {
    const handleRequestSetPT = vi.fn();
    const closeCardMenu = vi.fn();
    renderMenu({ card: makeCard(), dialogs: { handleRequestSetPT, closeCardMenu } });

    fireEvent.click(screen.getByText('Set P/T…'));

    expect(handleRequestSetPT).toHaveBeenCalled();
    expect(closeCardMenu).toHaveBeenCalled();
  });

  it('requests the Annotation prompt via parent callback', () => {
    const handleRequestSetAnnotation = vi.fn();
    renderMenu({ card: makeCard(), dialogs: { handleRequestSetAnnotation } });

    fireEvent.click(screen.getByText('Set Annotation…'));

    expect(handleRequestSetAnnotation).toHaveBeenCalled();
  });

  it('moves to hand via moveCard with x=-1 (append)', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 7 }), webClient });

    fireEvent.click(screen.getByText('Send to Hand'));

    const [gameId, targets, dest] = lastBulk(webClient, 'bulkMove');
    expect(gameId).toBe(1);
    expect(targetIds(targets as CardLocation[])).toEqual([7]);
    expect(dest).toEqual({ targetPlayerId: 1, targetZone: ZoneName.HAND, x: -1, y: 0 });
  });

  it('hides mutator items (tap, face up/down, move, counters, P/T) for opponent-owned cards (desktop parity)', () => {
    renderMenu({ localPlayerId: 1, ownerPlayerId: 2, card: makeCard({ id: 7 }) });

    expect(screen.queryByText('Face Down')).not.toBeInTheDocument();
    expect(screen.queryByText('Tap')).not.toBeInTheDocument();
    expect(screen.queryByText('Set P/T…')).not.toBeInTheDocument();
    expect(screen.queryByText('Counters')).not.toBeInTheDocument();
    expect(screen.queryByText('Send to Hand')).not.toBeInTheDocument();
    expect(screen.queryByText('Attach to card…')).not.toBeInTheDocument();

    expect(screen.getByText('Draw arrow from here')).toBeInTheDocument();
  });

  it('routes moves through the acting (local) player when invoked on an owned card', () => {
    const webClient = createMockWebClient();
    renderMenu({ localPlayerId: 1, ownerPlayerId: 1, card: makeCard({ id: 7 }), webClient });

    fireEvent.click(screen.getByText('Send to Hand'));

    // handleMove hands bulkMove the acting (local) player as the requested target;
    // sockatrice's bulkMove applies the owner-routing rule. See moveTargetPlayerId.
    const [, , dest] = lastBulk(webClient, 'bulkMove');
    expect(dest).toEqual(expect.objectContaining({ targetPlayerId: 1 }));
  });

  it('moves to library top vs bottom with distinct x values', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 7 }), webClient });

    fireEvent.click(screen.getByText('Send to Library (top)'));
    expect(lastBulk(webClient, 'bulkMove')[2]).toEqual(
      expect.objectContaining({ targetZone: ZoneName.DECK, x: 0 }),
    );

    fireEvent.click(screen.getByText('Send to Library (bottom)'));
    expect(lastBulk(webClient, 'bulkMove')[2]).toEqual(
      expect.objectContaining({ targetZone: ZoneName.DECK, x: -1 }),
    );
  });

  // Per-counter actions live three levels deep: Counters ▸ {label} ▸
  // {Add|Remove|Set Counter}. Navigate the chain via clicks.
  function openCounterSubmenu(label: string) {
    fireEvent.click(screen.getByText('Counters'));
    fireEvent.click(screen.getByText(label));
  }

  it('adds an A-type counter via incCardCounter (+1 on id 0)', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 9 }), webClient });

    openCounterSubmenu('A');
    fireEvent.click(screen.getByText('Add Counter'));

    expect(webClient.request.game.incCardCounter).toHaveBeenCalledWith(1, {
      zone: ZoneName.TABLE,
      cardId: 9,
      counterId: 0,
      counterDelta: 1,
    }, undefined);
  });

  it('adds a B-type counter via incCardCounter (+1 on id 1)', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 9 }), webClient });

    openCounterSubmenu('B');
    fireEvent.click(screen.getByText('Add Counter'));

    expect(webClient.request.game.incCardCounter).toHaveBeenCalledWith(1, {
      zone: ZoneName.TABLE,
      cardId: 9,
      counterId: 1,
      counterDelta: 1,
    }, undefined);
  });

  it('disables Remove Counter when card has no counters of that type', () => {
    renderMenu({ card: makeCard({ id: 9 }) });

    openCounterSubmenu('A');
    const item = screen.getByText('Remove Counter').closest('li');
    expect(item).toHaveClass('Mui-disabled');
  });

  it('removes a counter via incCardCounter (-1 on the matching id) when present', () => {
    const webClient = createMockWebClient();
    const card = makeCard({
      id: 9,
      counterList: [
        create(ServerInfo_CardCounterSchema, { id: 0, value: 2 }),
      ],
    });
    renderMenu({ card, webClient });

    openCounterSubmenu('A');
    fireEvent.click(screen.getByText('Remove Counter'));

    expect(webClient.request.game.incCardCounter).toHaveBeenCalledWith(1, {
      zone: ZoneName.TABLE,
      cardId: 9,
      counterId: 0,
      counterDelta: -1,
    }, undefined);
  });

  it('defers "Set Counter…" to the parent callback with the matching id', () => {
    const handleRequestSetCardCounter = vi.fn();
    renderMenu({ card: makeCard(), dialogs: { handleRequestSetCardCounter } });

    openCounterSubmenu('A');
    fireEvent.click(screen.getByText('Set Counter…'));

    expect(handleRequestSetCardCounter).toHaveBeenCalledWith(0);
  });

  it('defers "Draw arrow from here" to the parent callback', () => {
    const handleRequestDrawArrow = vi.fn();
    renderMenu({ card: makeCard(), dialogs: { handleRequestDrawArrow } });

    fireEvent.click(screen.getByText('Draw arrow from here'));

    expect(handleRequestDrawArrow).toHaveBeenCalled();
  });

  describe('Attach / Unattach', () => {
    it('defers "Attach to card…" to the parent callback', () => {
      const handleRequestAttach = vi.fn();
      const closeCardMenu = vi.fn();
      renderMenu({ card: makeCard(), dialogs: { handleRequestAttach, closeCardMenu } });

      fireEvent.click(screen.getByText('Attach to card…'));

      expect(handleRequestAttach).toHaveBeenCalled();
      expect(closeCardMenu).toHaveBeenCalled();
    });

    it('does not show "Unattach" when the card is not attached (attachCardId = -1)', () => {
      renderMenu({ card: makeCard({ attachCardId: -1 }) });

      expect(screen.queryByText('Unattach')).not.toBeInTheDocument();
    });

    it('shows "Unattach" and dispatches attachCard with only startZone+cardId (desktop parity)', () => {
      const webClient = createMockWebClient();
      const closeCardMenu = vi.fn();
      renderMenu({ card: makeCard({ id: 11, attachCardId: 99 }), webClient, dialogs: { closeCardMenu } });

      fireEvent.click(screen.getByText('Unattach'));

      expect(webClient.request.game.attachCard).toHaveBeenCalledWith(1, {
        startZone: ZoneName.TABLE,
        cardId: 11,
      }, undefined);
      expect(closeCardMenu).toHaveBeenCalled();
    });

    it('hides Attach / Unattach when the source card is not on the table', () => {
      renderMenu({ sourceZone: ZoneName.HAND, card: makeCard({ attachCardId: 99 }) });

      expect(screen.queryByText('Attach to card…')).not.toBeInTheDocument();
      expect(screen.queryByText('Unattach')).not.toBeInTheDocument();
    });
  });
});
