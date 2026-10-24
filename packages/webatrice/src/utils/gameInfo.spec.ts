import { create } from '@bufbuild/protobuf';
import type { TFunction } from 'i18next';

import { ServerInfo_GameSchema } from '@cockatrice/sockatrice/generated';

import { formatRestrictions, formatSpectators } from './gameInfo';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;

describe('formatRestrictions', () => {
  it('lists every restriction in desktop order', () => {
    const info = create(ServerInfo_GameSchema, {
      withPassword: true,
      onlyBuddies: true,
      onlyRegistered: true,
      shareDecklistsOnLoad: true,
    });
    expect(formatRestrictions(t, info)).toBe(
      'GameInfo.restriction.password, GameInfo.restriction.buddiesOnly, '
      + 'GameInfo.restriction.registeredOnly, GameInfo.restriction.openDecklists',
    );
  });

  it('is empty for an unrestricted game', () => {
    expect(formatRestrictions(t, create(ServerInfo_GameSchema, {}))).toBe('');
  });
});

describe('formatSpectators', () => {
  it('says when spectators are not allowed', () => {
    expect(formatSpectators(t, create(ServerInfo_GameSchema, { spectatorsAllowed: false }))).toBe(
      'GameInfo.spectators.notAllowed',
    );
  });

  it('shows the bare count without flags', () => {
    expect(formatSpectators(t, create(ServerInfo_GameSchema, { spectatorsAllowed: true, spectatorsCount: 3 }))).toBe('3');
  });

  it.each([
    [true, false, 'GameInfo.spectators.withChat {"count":2}'],
    [false, true, 'GameInfo.spectators.withHands {"count":2}'],
    [true, true, 'GameInfo.spectators.withChatAndHands {"count":2}'],
  ])('picks one whole message for canChat=%s, omniscient=%s', (spectatorsCanChat, spectatorsOmniscient, expected) => {
    const info = create(ServerInfo_GameSchema, {
      spectatorsAllowed: true,
      spectatorsCount: 2,
      spectatorsCanChat,
      spectatorsOmniscient,
    });
    expect(formatSpectators(t, info)).toBe(expected);
  });
});
