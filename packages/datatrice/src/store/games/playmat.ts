import type { ServerInfo_PlayerProperties_PlaymatParams } from '@cockatrice/sockatrice/generated';

export interface PlaymatParams {
  marginPctL: number;
  marginPctR: number;
  verticalOffset: number;
  zoom: number;
}

export interface Playmat {
  cardName: string;
  cardProviderId: string;
  params: PlaymatParams;
}

export const DEFAULT_PLAYMAT_PARAMS: PlaymatParams = {
  marginPctL: 0.07,
  marginPctR: 0.07,
  verticalOffset: 0.33,
  zoom: 1,
};

const clamp = (value: number, min: number, max: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function clampPlaymatParams(params: PlaymatParams): PlaymatParams {
  return {
    marginPctL: clamp(params.marginPctL, 0, 0.95, DEFAULT_PLAYMAT_PARAMS.marginPctL),
    marginPctR: clamp(params.marginPctR, 0, 0.95, DEFAULT_PLAYMAT_PARAMS.marginPctR),
    verticalOffset: clamp(params.verticalOffset, 0, 1, DEFAULT_PLAYMAT_PARAMS.verticalOffset),
    zoom: clamp(params.zoom, 0.1, 4, DEFAULT_PLAYMAT_PARAMS.zoom),
  };
}

export function playmatFromParams(params: ServerInfo_PlayerProperties_PlaymatParams | undefined): Playmat | null {
  if (!params?.cardName) {
    return null;
  }
  return {
    cardName: params.cardName,
    cardProviderId: params.cardProviderId,
    params: clampPlaymatParams(params),
  };
}
