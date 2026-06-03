import { screen, fireEvent } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import {
  CardAttribute,
  ServerInfo_Card,
  ServerInfo_CardCounterSchema,
} from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
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
  const sourceZone = opts.sourceZone ?? Enriched.ZoneName.TABLE;
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

    expect(webClient.request.game.flipCard).toHaveBeenCalledWith(1, {
      zone: Enriched.ZoneName.TABLE,
      cardId: 10,
      faceDown: true,
    }, undefined);
    expect(closeCardMenu).toHaveBeenCalled();
  });

  it('toggles tap via setCardAttr (untapped → tapped)', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, tapped: false }), webClient });

    fireEvent.click(screen.getByText('Tap'));

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(1, {
      zone: Enriched.ZoneName.TABLE,
      cardId: 5,
      attribute: CardAttribute.AttrTapped,
      attrValue: '1',
    }, undefined);
  });

  it('shows Untap label and sends "0" when the card is already tapped', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, tapped: true }), webClient });

    expect(screen.getByText('Untap')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Untap'));

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(1, {
      zone: Enriched.ZoneName.TABLE,
      cardId: 5,
      attribute: CardAttribute.AttrTapped,
      attrValue: '0',
    }, undefined);
  });

  // Regression: revealing a face-down card must go through Command_FlipCard, whose event
  // carries the revealed name/providerId — setCardAttr(AttrFaceDown) does not, so a card
  // revealed after resuming a game (no local identity) would render blank.
  it('turns a face-down card face up via flipCard and shows the Face Up label', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, faceDown: true }), webClient });

    expect(screen.getByText('Face Up')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Face Up'));

    expect(webClient.request.game.flipCard).toHaveBeenCalledWith(1, {
      zone: Enriched.ZoneName.TABLE,
      cardId: 5,
      faceDown: false,
    }, undefined);
    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
  });

  it('toggles Doesn\'t Untap and shows Allow Untap when already set', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 5, doesntUntap: true }), webClient });

    expect(screen.getByText('Allow Untap')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Allow Untap'));

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(1, {
      zone: Enriched.ZoneName.TABLE,
      cardId: 5,
      attribute: CardAttribute.AttrDoesntUntap,
      attrValue: '0',
    }, undefined);
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

    expect(webClient.request.game.moveCard).toHaveBeenCalledWith(1, {
      startPlayerId: 1,
      startZone: Enriched.ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: 7 }] },
      targetPlayerId: 1,
      targetZone: Enriched.ZoneName.HAND,
      x: -1,
      y: 0,
      isReversed: false,
    }, undefined);
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

    expect(webClient.request.game.moveCard).toHaveBeenCalledWith(1, expect.objectContaining({
      startPlayerId: 1,
      targetPlayerId: 1,
    }), undefined);
  });

  it('moves to library top vs bottom with distinct x values', () => {
    const webClient = createMockWebClient();
    renderMenu({ card: makeCard({ id: 7 }), webClient });

    fireEvent.click(screen.getByText('Send to Library (top)'));
    expect(webClient.request.game.moveCard).toHaveBeenLastCalledWith(1, expect.objectContaining({
      targetZone: Enriched.ZoneName.DECK,
      x: 0,
    }), undefined);

    fireEvent.click(screen.getByText('Send to Library (bottom)'));
    expect(webClient.request.game.moveCard).toHaveBeenLastCalledWith(1, expect.objectContaining({
      targetZone: Enriched.ZoneName.DECK,
      x: -1,
    }), undefined);
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
      zone: Enriched.ZoneName.TABLE,
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
      zone: Enriched.ZoneName.TABLE,
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
      zone: Enriched.ZoneName.TABLE,
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
        startZone: Enriched.ZoneName.TABLE,
        cardId: 11,
      }, undefined);
      expect(closeCardMenu).toHaveBeenCalled();
    });

    it('hides Attach / Unattach when the source card is not on the table', () => {
      renderMenu({ sourceZone: Enriched.ZoneName.HAND, card: makeCard({ attachCardId: 99 }) });

      expect(screen.queryByText('Attach to card…')).not.toBeInTheDocument();
      expect(screen.queryByText('Unattach')).not.toBeInTheDocument();
    });
  });
});
