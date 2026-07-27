// @critical *_RGBA / *_CSS pairs must stay in sync with `:root` in src/colors.css.
export interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Cockatrice desktop uses raw Qt named colors for arrows — see
// `CardItem::mouseMoveEvent` in card_item.cpp:338-345. Match those 1:1
// (pure primaries) instead of a designer palette so the shafts read as
// the exact same red/yellow/blue/green the desktop client draws.
export const ArrowColor = {
  RED: { r: 255, g: 0, b: 0, a: 255 } as ColorRGBA,
  YELLOW: { r: 255, g: 255, b: 0, a: 255 } as ColorRGBA,
  BLUE: { r: 0, g: 0, b: 255, a: 255 } as ColorRGBA,
  GREEN: { r: 0, g: 255, b: 0, a: 255 } as ColorRGBA,
} as const;

export const HIGHLIGHT_YELLOW_CSS = '#f7b01c';

export function rgbaToCss(c: ColorRGBA): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`;
}
