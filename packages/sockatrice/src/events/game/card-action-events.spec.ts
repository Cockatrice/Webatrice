vi.mock('../../WebClient');
import { create } from '@bufbuild/protobuf';
import {
  Event_AttachCardSchema,
  Event_CreateTokenSchema,
  Event_DestroyCardSchema,
  Event_DrawCardsSchema,
  Event_FlipCardSchema,
  Event_MoveCardSchema,
  Event_RevealCardsSchema,
  Event_SetCardAttrSchema,
} from '../../generated';
import { WebClient } from '../../WebClient';
import { attachCard } from './attachCard';
import { createToken } from './createToken';
import { destroyCard } from './destroyCard';
import { drawCards } from './drawCards';
import { flipCard } from './flipCard';
import { moveCard } from './moveCard';
import { revealCards } from './revealCards';
import { setCardAttr } from './setCardAttr';

const meta = { gameId: 5, playerId: 2, context: null, secondsElapsed: 0, forcedByJudge: 0 };

describe('moveCard event', () => {
  it('delegates to WebClient.instance.response.game.cardMoved with gameId, playerId and data', () => {
    const data = create(Event_MoveCardSchema, { cardId: 3 });
    moveCard(data, meta);
    expect(WebClient.instance.response.game.cardMoved).toHaveBeenCalledWith(5, 2, data);
  });

  it('forwards the full move payload intact so reducer-side implicit-detach can fire', () => {
    const data = create(Event_MoveCardSchema, {
      cardId: 7,
      startZone: 'table',
      targetZone: 'hand',
    });
    moveCard(data, meta);
    const [forwardedGameId, forwardedPlayerId, forwardedData] =
      (WebClient.instance.response.game.cardMoved as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(forwardedGameId).toBe(5);
    expect(forwardedPlayerId).toBe(2);
    expect(forwardedData).toBe(data);
    expect(forwardedData.cardId).toBe(7);
    expect(forwardedData.startZone).toBe('table');
    expect(forwardedData.targetZone).toBe('hand');
  });

  it('forwards an empty move payload (malformed: no cardId or zones) without dropping it', () => {
    const data = create(Event_MoveCardSchema, {});
    moveCard(data, meta);
    expect(WebClient.instance.response.game.cardMoved).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('flipCard event', () => {
  it('delegates to WebClient.instance.response.game.cardFlipped with gameId, playerId and data', () => {
    const data = create(Event_FlipCardSchema, { cardId: 3 });
    flipCard(data, meta);
    expect(WebClient.instance.response.game.cardFlipped).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('destroyCard event', () => {
  it('delegates to WebClient.instance.response.game.cardDestroyed with gameId, playerId and data', () => {
    const data = create(Event_DestroyCardSchema, { cardId: 3 });
    destroyCard(data, meta);
    expect(WebClient.instance.response.game.cardDestroyed).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('attachCard event', () => {
  it('delegates to WebClient.instance.response.game.cardAttached with gameId, playerId and data', () => {
    const data = create(Event_AttachCardSchema, { cardId: 3 });
    attachCard(data, meta);
    expect(WebClient.instance.response.game.cardAttached).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('createToken event', () => {
  it('delegates to WebClient.instance.response.game.tokenCreated with gameId, playerId and data', () => {
    const data = create(Event_CreateTokenSchema, { cardId: 3 });
    createToken(data, meta);
    expect(WebClient.instance.response.game.tokenCreated).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('setCardAttr event', () => {
  it('delegates to WebClient.instance.response.game.cardAttrChanged with gameId, playerId and data', () => {
    const data = create(Event_SetCardAttrSchema, { cardId: 3 });
    setCardAttr(data, meta);
    expect(WebClient.instance.response.game.cardAttrChanged).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('drawCards event', () => {
  it('delegates to WebClient.instance.response.game.cardsDrawn with gameId, playerId and data', () => {
    const data = create(Event_DrawCardsSchema, { number: 2, cards: [] });
    drawCards(data, meta);
    expect(WebClient.instance.response.game.cardsDrawn).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('revealCards event', () => {
  it('delegates to WebClient.instance.response.game.cardsRevealed with gameId, playerId and data', () => {
    const data = create(Event_RevealCardsSchema, { zoneName: 'hand', cards: [] });
    revealCards(data, meta);
    expect(WebClient.instance.response.game.cardsRevealed).toHaveBeenCalledWith(5, 2, data);
  });

  it('forwards a malformed reveal payload (no zoneName) intact', () => {
    const data = create(Event_RevealCardsSchema, { cards: [] });
    revealCards(data, meta);
    expect(WebClient.instance.response.game.cardsRevealed).toHaveBeenCalledWith(5, 2, data);
  });
});
