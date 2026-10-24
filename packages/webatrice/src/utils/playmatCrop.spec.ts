import {
  CROP_LABEL_KEYS, CROP_SLIDERS, computeArtSourceRect, computeArtWindowRect, coverFitRect, playmatArtBox, playmatImageBox,
} from './playmatCrop';

const CARD = { width: 672, height: 936 };
const DEFAULTS = { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 };

describe('computeArtSourceRect', () => {
  it('trims the margins into a square window placed by the vertical offset', () => {
    const rect = computeArtSourceRect(CARD, DEFAULTS);
    expect(rect.width).toBeCloseTo(577.92);
    expect(rect.height).toBeCloseTo(577.92);
    expect(rect.x).toBeCloseTo(47.04);
    expect(rect.y).toBeCloseTo(0.33 * (936 - 577.92));
  });

  it('zooms into the trimmed span, centred between the margins', () => {
    const rect = computeArtSourceRect(CARD, { ...DEFAULTS, zoom: 2 });
    expect(rect.width).toBeCloseTo(288.96);
    expect(rect.x).toBeCloseTo(47.04 + (577.92 - 288.96) / 2);
  });

  it('floors the zoom-out so the window never exceeds the card', () => {
    const rect = computeArtSourceRect(CARD, { marginPctL: 0, marginPctR: 0, verticalOffset: 1, zoom: 0.1 });
    expect(rect).toEqual({ x: 0, y: 936 - 672, width: 672, height: 672 });
  });

  it('caps the zoom-out floor at 4x like desktop', () => {
    const wide = { width: 936, height: 100 };
    const rect = computeArtSourceRect(wide, { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 });
    expect(rect).toEqual({ x: (936 - 234) / 2, y: 0, width: 234, height: 234 });
  });

  it('collapses when the margins leave nothing visible', () => {
    expect(computeArtSourceRect(CARD, { ...DEFAULTS, marginPctL: 0.95, marginPctR: 0.95 }).width).toBe(0);
  });
});

describe('coverFitRect', () => {
  it('overflows vertically when the area is wider than the source', () => {
    expect(coverFitRect({ x: 0, y: 0, width: 1000, height: 300 }, { width: 1, height: 1 }))
      .toEqual({ x: 0, y: -350, width: 1000, height: 1000 });
  });

  it('overflows horizontally when the area is taller than the source', () => {
    expect(coverFitRect({ x: 10, y: 0, width: 200, height: 400 }, { width: 1, height: 1 }))
      .toEqual({ x: -90, y: 0, width: 400, height: 400 });
  });
});

describe('playmatImageBox', () => {
  it('scales the card so the crop window lands on the cover rect', () => {
    const box = playmatImageBox(CARD, DEFAULTS, { width: 1000, height: 300 })!;
    const scale = 1000 / 577.92;
    expect(box.width).toBeCloseTo(672 * scale);
    expect(box.height).toBeCloseTo(936 * scale);
    expect(box.x).toBeCloseTo(-47.04 * scale);
    expect(box.y).toBeCloseTo(-350 - 0.33 * (936 - 577.92) * scale);
  });

  it('returns null for an empty area or crop', () => {
    expect(playmatImageBox(CARD, DEFAULTS, { width: 0, height: 300 })).toBeNull();
    expect(playmatImageBox(CARD, { ...DEFAULTS, marginPctL: 0.95, marginPctR: 0.95 }, { width: 100, height: 100 })).toBeNull();
  });
});

const ART = { width: 626, height: 457 };

describe('computeArtWindowRect', () => {
  it('takes the area aspect across the trimmed width, placed by the vertical offset', () => {
    const rect = computeArtWindowRect(ART, DEFAULTS, 3);
    expect(rect.width).toBeCloseTo(538.36);
    expect(rect.height).toBeCloseTo(538.36 / 3);
    expect(rect.x).toBeCloseTo(43.82);
    expect(rect.y).toBeCloseTo(0.33 * (457 - 538.36 / 3));
  });

  it('fits the height first when the area is taller than the trimmed art', () => {
    const rect = computeArtWindowRect(ART, { ...DEFAULTS, verticalOffset: 1 }, 1);
    expect(rect).toMatchObject({ width: 457, height: 457, y: 0 });
    expect(rect.x).toBeCloseTo(43.82 + (538.36 - 457) / 2);
  });

  it('zooms into the window and never zooms out past the art', () => {
    expect(computeArtWindowRect(ART, { ...DEFAULTS, zoom: 2 }, 3).width).toBeCloseTo(538.36 / 2);
    expect(computeArtWindowRect(ART, { ...DEFAULTS, zoom: 0.1 }, 3)).toEqual(computeArtWindowRect(ART, DEFAULTS, 3));
    expect(computeArtWindowRect(ART, { ...DEFAULTS, zoom: 9 }, 3)).toEqual(computeArtWindowRect(ART, { ...DEFAULTS, zoom: 4 }, 3));
  });

  it('collapses when the margins leave nothing visible', () => {
    expect(computeArtWindowRect(ART, { ...DEFAULTS, marginPctL: 0.95, marginPctR: 0.95 }, 3).width).toBe(0);
  });
});

describe('playmatArtBox', () => {
  it('scales the art so the window fills the area exactly', () => {
    const box = playmatArtBox(ART, { marginPctL: 0, marginPctR: 0, verticalOffset: 0.5, zoom: 1 }, { width: 1252, height: 313 })!;
    expect(box.x).toBeCloseTo(0);
    expect(box.width).toBeCloseTo(1252);
    expect(box.height).toBeCloseTo(914);
    expect(box.y).toBeCloseTo(-0.5 * (914 - 313));
  });

  it('returns null for an empty area or window', () => {
    expect(playmatArtBox(ART, DEFAULTS, { width: 300, height: 0 })).toBeNull();
    expect(playmatArtBox(ART, { ...DEFAULTS, marginPctL: 0.95, marginPctR: 0.95 }, { width: 100, height: 100 })).toBeNull();
  });
});

describe('CROP_SLIDERS', () => {
  it('describes every crop parameter once, with a label', () => {
    expect(CROP_SLIDERS.map((slider) => slider.key).sort()).toEqual(Object.keys(DEFAULTS).sort());
    expect(CROP_SLIDERS.every((slider) => CROP_LABEL_KEYS[slider.key].startsWith('PlaymatSettings.crop.'))).toBe(true);
  });

  it('stops the zoom slider where the renderer stops zooming', () => {
    const zoom = CROP_SLIDERS.find((slider) => slider.key === 'zoom')!;
    const atMax = computeArtSourceRect(CARD, { ...DEFAULTS, zoom: zoom.max });
    expect(computeArtSourceRect(CARD, { ...DEFAULTS, zoom: zoom.max - zoom.step }).width).toBeGreaterThan(atMax.width);
    expect(computeArtSourceRect(CARD, { ...DEFAULTS, zoom: zoom.max + zoom.step })).toEqual(atMax);
  });

  it('formats margins as whole percentages and the offset and zoom with two decimals', () => {
    expect(CROP_SLIDERS.map((slider) => slider.format(0.07))).toEqual(['7', '7', '0.07', '0.07']);
  });
});
