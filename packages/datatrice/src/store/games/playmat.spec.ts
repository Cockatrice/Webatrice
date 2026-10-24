import { create } from '@bufbuild/protobuf';
import { ServerInfo_PlayerProperties_PlaymatParamsSchema } from '@cockatrice/sockatrice/generated';

import { DEFAULT_PLAYMAT_PARAMS, clampPlaymatParams, playmatFromParams } from './playmat';

describe('playmatFromParams', () => {
  it('returns null when no params are announced', () => {
    expect(playmatFromParams(undefined)).toBeNull();
  });

  it('returns null for an empty card name, which clears the playmat', () => {
    expect(playmatFromParams(create(ServerInfo_PlayerProperties_PlaymatParamsSchema, { zoom: 2 }))).toBeNull();
  });

  it('takes the proto defaults for unset crop fields', () => {
    const params = create(ServerInfo_PlayerProperties_PlaymatParamsSchema, { cardName: 'Island' });
    expect(playmatFromParams(params)).toEqual({ cardName: 'Island', cardProviderId: '', params: DEFAULT_PLAYMAT_PARAMS });
  });

  it('clamps the crop to the ranges desktop enforces', () => {
    const params = create(ServerInfo_PlayerProperties_PlaymatParamsSchema, {
      cardName: 'Island',
      cardProviderId: 'uuid-1',
      marginPctL: -1,
      marginPctR: 2,
      verticalOffset: 1.5,
      zoom: 0,
    });
    expect(playmatFromParams(params)).toEqual({
      cardName: 'Island',
      cardProviderId: 'uuid-1',
      params: { marginPctL: 0, marginPctR: 0.95, verticalOffset: 1, zoom: 0.1 },
    });
  });
});

describe('clampPlaymatParams', () => {
  it('falls back to the default for a non-finite value', () => {
    expect(clampPlaymatParams({ ...DEFAULT_PLAYMAT_PARAMS, zoom: Number.NaN }).zoom).toBe(DEFAULT_PLAYMAT_PARAMS.zoom);
  });

  it('keeps values already in range', () => {
    const params = { marginPctL: 0.1, marginPctR: 0.2, verticalOffset: 0.5, zoom: 3 };
    expect(clampPlaymatParams(params)).toEqual(params);
  });
});
