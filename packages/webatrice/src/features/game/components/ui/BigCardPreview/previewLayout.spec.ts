import type { PreviewAnchor } from '../CardPreviewContext';
import {
  ANCHOR_GAP,
  CARD_ASPECT,
  floatingPreviewLayout,
  MAX_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
  MIN_SHRINK_WITH_TEXT,
  preferredImageWidth,
  VIEWPORT_MARGIN,
} from './previewLayout';

const LAPTOP = { width: 1440, height: 900 };
const SMALL = { width: 1280, height: 720 };
const IMAGE_ONLY = { x: 0, y: 0, textWidth: 0 };
const WITH_TEXT = { x: 24, y: 24, textWidth: 292 };

const cardAt = (left: number, top: number, width = 72, height = 102): PreviewAnchor =>
  ({ left, top, right: left + width, bottom: top + height });

type Placed = { left: number; imageWidth: number; textWidth: number };

const overlaps = (anchor: PreviewAnchor, layout: Placed, chrome = IMAGE_ONLY) => {
  const right = layout.left + layout.imageWidth + chrome.x + layout.textWidth;
  return layout.left < anchor.right && right > anchor.left;
};

describe('preferredImageWidth', () => {
  it('sizes the card from the viewport height so rules text stays legible on a laptop', () => {
    expect(preferredImageWidth(LAPTOP)).toBe(Math.round((900 * 0.62) / CARD_ASPECT));
    expect(preferredImageWidth(LAPTOP)).toBeGreaterThanOrEqual(380);
    expect(preferredImageWidth(SMALL)).toBeGreaterThanOrEqual(310);
  });

  it('caps the size on tall screens and never drops below the readable minimum', () => {
    expect(preferredImageWidth({ width: 3840, height: 2160 })).toBe(Math.round(MAX_IMAGE_HEIGHT / CARD_ASPECT));
    expect(preferredImageWidth({ width: 500, height: 300 })).toBe(MIN_IMAGE_WIDTH);
  });
});

describe('floatingPreviewLayout', () => {
  it('opens beside the card, on the side with more room, without covering it', () => {
    const left = cardAt(200, 400);
    const atLeft = floatingPreviewLayout(left, LAPTOP, IMAGE_ONLY);
    expect(atLeft.left).toBe(left.right + ANCHOR_GAP);
    expect(overlaps(left, atLeft)).toBe(false);

    const right = cardAt(1200, 400);
    const atRight = floatingPreviewLayout(right, LAPTOP, IMAGE_ONLY);
    expect(atRight.left + atRight.imageWidth).toBe(right.left - ANCHOR_GAP);
    expect(overlaps(right, atRight)).toBe(false);
  });

  it('keeps the preview inside the viewport vertically', () => {
    const top = floatingPreviewLayout(cardAt(200, 0), LAPTOP, IMAGE_ONLY);
    expect(top.top).toBe(VIEWPORT_MARGIN);
    const bottom = floatingPreviewLayout(cardAt(200, 860, 72, 40), LAPTOP, IMAGE_ONLY);
    expect(bottom.top + bottom.imageHeight).toBe(LAPTOP.height - VIEWPORT_MARGIN);
  });

  it('shrinks the card a little to keep the text column beside a centred card', () => {
    const middle = cardAt(604, 300);
    const layout = floatingPreviewLayout(middle, SMALL, WITH_TEXT);
    expect(layout.textWidth).toBe(WITH_TEXT.textWidth);
    expect(layout.imageWidth).toBeGreaterThanOrEqual(preferredImageWidth(SMALL) * MIN_SHRINK_WITH_TEXT);
    expect(overlaps(middle, layout, WITH_TEXT)).toBe(false);
    expect(layout.left + layout.imageWidth + WITH_TEXT.x + layout.textWidth).toBeLessThanOrEqual(SMALL.width - VIEWPORT_MARGIN);
  });

  it('drops the text column rather than shrinking the card further', () => {
    const card = cardAt(560, 300, 160, 102);
    const layout = floatingPreviewLayout(card, SMALL, WITH_TEXT);
    expect(layout.textWidth).toBe(0);
    expect(layout.imageWidth).toBe(preferredImageWidth(SMALL));
    expect(overlaps(card, layout, WITH_TEXT)).toBe(false);
  });

  it('keeps the text column when there is room for it', () => {
    const layout = floatingPreviewLayout(cardAt(100, 300), LAPTOP, WITH_TEXT);
    expect(layout.textWidth).toBe(WITH_TEXT.textWidth);
    expect(layout.imageWidth).toBe(preferredImageWidth(LAPTOP));
  });

  it('centres in the viewport when it has no card to sit beside', () => {
    const layout = floatingPreviewLayout(null, LAPTOP, WITH_TEXT);
    const width = layout.imageWidth + WITH_TEXT.x + layout.textWidth;
    expect(layout.left).toBe(Math.round((LAPTOP.width - width) / 2));
    expect(layout.top).toBe(Math.round((LAPTOP.height - layout.imageHeight - WITH_TEXT.y) / 2));
  });
});
