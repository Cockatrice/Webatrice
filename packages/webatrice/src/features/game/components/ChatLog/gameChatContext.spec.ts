import { gameChatContext } from './gameChatContext';

const at = new Date(2026, 0, 1, 8, 0, 0).getTime();

describe('gameChatContext', () => {
  it('keeps player chat and drops event lines', () => {
    const log = gameChatContext([
      { playerId: 1, senderName: 'alice', message: 'gg', timeReceived: at, kind: 'chat' },
      { playerId: 1, message: 'alice draws a card.', timeReceived: at, kind: 'event' },
    ]);
    expect(log).toBe('[08:00:00] alice: gg');
  });

  it('keeps the lines of a player who has left, under the name captured on arrival', () => {
    expect(gameChatContext([{ playerId: 9, senderName: 'mallory', message: 'hi', timeReceived: at, kind: 'chat' }]))
      .toBe('[08:00:00] mallory: hi');
  });

  it('drops a chat line whose sender was never known', () => {
    expect(gameChatContext([{ playerId: 9, message: 'hi', timeReceived: at, kind: 'chat' }])).toBe('');
  });
});
