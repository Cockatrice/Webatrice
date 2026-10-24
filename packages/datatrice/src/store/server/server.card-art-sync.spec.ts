import { create } from '@bufbuild/protobuf';
import { Response_CardArtRuleEntrySchema } from '@cockatrice/sockatrice/generated';
import { makeServerState } from '../../testing/fixtures/server';
import { serverReducer } from './server.reducer';
import { Actions } from './server.actions';
import { Types } from './server.types';

it.each(['add', 'remove'])('keeps the list response authoritative after %s acknowledgements', (command) => {
  const entries = [create(Response_CardArtRuleEntrySchema, { cardName: 'Island', cardProviderId: 'a', mode: 'DENY' })];
  const state = serverReducer(makeServerState(), Actions.cardArtRules({ entries }));
  const action = command === 'add'
    ? Actions.cardArtRuleAdded({ cardName: 'Forest', cardProviderId: 'b', mode: 'ALLOW', reason: '' })
    : Actions.cardArtRuleRemoved({ cardName: 'Island', cardProviderId: 'a' });
  const result = serverReducer(state, action);
  expect(result.staff.cardArtRules).toBe(entries);
  const refreshed = serverReducer(result, Actions.cardArtRules({ entries: [] }));
  expect(refreshed.staff.cardArtRules).toEqual([]);
});

it('exports the card-art acknowledgement action types', () => {
  expect((Types as Record<string, string>).CARD_ART_RULE_ADDED).toBe(Actions.cardArtRuleAdded.type);
  expect((Types as Record<string, string>).CARD_ART_RULE_REMOVED).toBe(Actions.cardArtRuleRemoved.type);
});
