// @critical *_RGBA / *_CSS pairs must stay in sync with `:root` in src/colors.css.
export interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const ArrowColor = {
  RED: { r: 224, g: 75, b: 59, a: 255 } as ColorRGBA,
  YELLOW: { r: 240, g: 200, b: 60, a: 255 } as ColorRGBA,
  BLUE: { r: 137, g: 184, b: 224, a: 255 } as ColorRGBA,
  GREEN: { r: 61, g: 162, b: 107, a: 255 } as ColorRGBA,
} as const;

export const HIGHLIGHT_YELLOW_CSS = '#f7b01c';

export function rgbaToCss(c: ColorRGBA): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`;
}
