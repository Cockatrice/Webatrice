import type { PreviewAnchor } from '../CardPreviewContext';

export interface Viewport {
  width: number;
  height: number;
}

export interface PreviewChrome {
  x: number;
  y: number;
  textWidth: number;
}

export interface FloatingPreviewLayout {
  left: number;
  top: number;
  imageWidth: number;
  imageHeight: number;
  textWidth: number;
}

export const CARD_ASPECT = 7 / 5;
export const VIEWPORT_MARGIN = 8;
export const ANCHOR_GAP = 16;
export const MIN_IMAGE_WIDTH = 220;
export const MAX_IMAGE_HEIGHT = 680;
export const IMAGE_HEIGHT_SHARE = 0.62;
export const IMAGE_WIDTH_SHARE = 0.34;
export const MIN_SHRINK_WITH_TEXT = 0.8;

export function preferredImageWidth(viewport: Viewport): number {
  const byHeight = Math.min(viewport.height * IMAGE_HEIGHT_SHARE, MAX_IMAGE_HEIGHT) / CARD_ASPECT;
  return Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(byHeight, viewport.width * IMAGE_WIDTH_SHARE)));
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

function fitInto(room: number, preferred: number, chrome: PreviewChrome): { imageWidth: number; textWidth: number } | null {
  const text = chrome.textWidth;
  if (preferred + chrome.x + text <= room) {
    return { imageWidth: preferred, textWidth: text };
  }
  const shrunk = Math.floor(room - chrome.x - text);
  if (text > 0 && shrunk >= Math.max(MIN_IMAGE_WIDTH, preferred * MIN_SHRINK_WITH_TEXT)) {
    return { imageWidth: shrunk, textWidth: text };
  }
  const alone = Math.floor(Math.min(preferred, room - chrome.x));
  return alone >= MIN_IMAGE_WIDTH ? { imageWidth: alone, textWidth: 0 } : null;
}

export function floatingPreviewLayout(
  anchor: PreviewAnchor | null,
  viewport: Viewport,
  chrome: PreviewChrome,
): FloatingPreviewLayout {
  const maxByHeight = Math.floor((viewport.height - 2 * VIEWPORT_MARGIN - chrome.y) / CARD_ASPECT);
  const preferred = Math.max(0, Math.min(preferredImageWidth(viewport), maxByHeight));
  const finish = (left: number, centerY: number, imageWidth: number, textWidth: number): FloatingPreviewLayout => {
    const imageHeight = Math.round(imageWidth * CARD_ASPECT);
    const height = imageHeight + chrome.y;
    return {
      left: Math.round(left),
      top: Math.round(clamp(centerY - height / 2, VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - height)),
      imageWidth,
      imageHeight,
      textWidth,
    };
  };

  if (anchor) {
    const centerY = (anchor.top + anchor.bottom) / 2;
    const roomRight = viewport.width - VIEWPORT_MARGIN - anchor.right - ANCHOR_GAP;
    const roomLeft = anchor.left - ANCHOR_GAP - VIEWPORT_MARGIN;
    const sides = roomRight >= roomLeft ? (['right', 'left'] as const) : (['left', 'right'] as const);
    const fits = sides.map((side) => ({ side, fit: fitInto(side === 'right' ? roomRight : roomLeft, preferred, chrome) }));
    const full = fits.find(({ fit }) => fit && fit.imageWidth === preferred && fit.textWidth === chrome.textWidth);
    const chosen = full ?? fits.find(({ fit }) => fit != null);
    if (chosen?.fit) {
      const { imageWidth, textWidth } = chosen.fit;
      const width = imageWidth + chrome.x + textWidth;
      const left = chosen.side === 'right' ? anchor.right + ANCHOR_GAP : anchor.left - ANCHOR_GAP - width;
      return finish(left, centerY, imageWidth, textWidth);
    }
  }

  const fit = fitInto(viewport.width - 2 * VIEWPORT_MARGIN, preferred, chrome)
    ?? { imageWidth: Math.max(0, Math.floor(viewport.width - 2 * VIEWPORT_MARGIN - chrome.x)), textWidth: 0 };
  const width = fit.imageWidth + chrome.x + fit.textWidth;
  return finish((viewport.width - width) / 2, viewport.height / 2, fit.imageWidth, fit.textWidth);
}
