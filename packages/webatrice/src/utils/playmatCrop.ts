import type { games } from '@cockatrice/datatrice';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

const MAX_ZOOM = 4;

function visibleWidth(card: Size, params: games.PlaymatParams): number {
  return Math.max(0, card.width - params.marginPctL * card.width - params.marginPctR * card.width);
}

function clampedZoom(card: Size, params: games.PlaymatParams): number {
  const minDim = Math.min(card.width, card.height);
  const visibleW = visibleWidth(card, params);
  const zoomOutFloor = minDim > 0 && visibleW > 0 ? visibleW / minDim : 1;
  return Math.min(MAX_ZOOM, Math.max(params.zoom, zoomOutFloor));
}

export function computeArtSourceRect(card: Size, params: games.PlaymatParams): Rect {
  const visibleW = visibleWidth(card, params);
  const side = visibleW > 0 ? visibleW / clampedZoom(card, params) : 0;
  const offset = Math.min(1, Math.max(0, params.verticalOffset));
  const y = offset * Math.max(0, card.height - side);
  const x = Math.min(
    Math.max(0, params.marginPctL * card.width + (visibleW - side) / 2),
    Math.max(0, card.width - side),
  );
  return { x, y, width: side, height: side };
}

export function coverFitRect(area: Rect, source: Size): Rect {
  const sourceAspect = source.width / source.height;
  const areaAspect = area.width / area.height;
  if (sourceAspect > areaAspect) {
    const width = area.height * sourceAspect;
    return { x: area.x + (area.width - width) / 2, y: area.y, width, height: area.height };
  }
  const height = area.width / sourceAspect;
  return { x: area.x, y: area.y + (area.height - height) / 2, width: area.width, height };
}

export function computeArtWindowRect(art: Size, params: games.PlaymatParams, aspect: number): Rect {
  const visibleW = visibleWidth(art, params);
  if (visibleW <= 0 || !(aspect > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const zoom = Math.min(MAX_ZOOM, Math.max(1, params.zoom));
  const width = Math.min(visibleW, art.height * aspect) / zoom;
  const height = width / aspect;
  const offset = Math.min(1, Math.max(0, params.verticalOffset));
  const x = Math.min(
    Math.max(0, params.marginPctL * art.width + (visibleW - width) / 2),
    Math.max(0, art.width - width),
  );
  return { x, y: offset * Math.max(0, art.height - height), width, height };
}

function boxForSource(image: Size, source: Rect, area: Size): Rect | null {
  if (source.width <= 0 || source.height <= 0 || area.width <= 0 || area.height <= 0) {
    return null;
  }
  const target = coverFitRect({ x: 0, y: 0, ...area }, source);
  const scale = target.width / source.width;
  return {
    x: target.x - source.x * scale,
    y: target.y - source.y * scale,
    width: image.width * scale,
    height: image.height * scale,
  };
}

export function playmatImageBox(card: Size, params: games.PlaymatParams, area: Size): Rect | null {
  return boxForSource(card, computeArtSourceRect(card, params), area);
}

export function playmatArtBox(art: Size, params: games.PlaymatParams, area: Size): Rect | null {
  return area.height > 0 ? boxForSource(art, computeArtWindowRect(art, params, area.width / area.height), area) : null;
}

export type CropKey = keyof games.PlaymatParams;

export const CROP_LABEL_KEYS: Record<CropKey, string> = {
  marginPctL: 'PlaymatSettings.crop.leftMargin',
  marginPctR: 'PlaymatSettings.crop.rightMargin',
  verticalOffset: 'PlaymatSettings.crop.verticalOffset',
  zoom: 'PlaymatSettings.crop.zoom',
};

export const asPercent = (value: number) => `${Math.round(value * 100)}`;
export const asDecimal = (value: number) => value.toFixed(2);

export const CROP_SLIDERS: readonly { key: CropKey; min: number; max: number; step: number; format: (value: number) => string }[] = [
  { key: 'marginPctL', min: 0, max: 0.95, step: 0.01, format: asPercent },
  { key: 'marginPctR', min: 0, max: 0.95, step: 0.01, format: asPercent },
  { key: 'verticalOffset', min: 0, max: 1, step: 0.01, format: asDecimal },
  { key: 'zoom', min: 0.1, max: MAX_ZOOM, step: 0.05, format: asDecimal },
];
