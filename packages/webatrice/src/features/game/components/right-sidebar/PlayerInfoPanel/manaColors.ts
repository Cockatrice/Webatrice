export const MANA_COLORS: Array<{
  symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O';
  tint: string;
}> = [
  { symbol: 'W', tint: 'rgb(var(--mana-w))' },
  { symbol: 'U', tint: 'rgb(var(--mana-u))' },
  { symbol: 'B', tint: 'rgb(var(--mana-b))' },
  { symbol: 'R', tint: 'rgb(var(--mana-r))' },
  { symbol: 'G', tint: 'rgb(var(--mana-g))' },
  { symbol: 'C', tint: 'rgb(var(--mana-c))' },
  // 7th slot — Cockatrice's server pre-creates a "storm" counter
  // (id=7) with orange makeColor(255, 150, 30) at server_player.cpp:102;
  // the desktop UI labels it "Other" and slots it after the colorless
  // pip. We mirror both the position and the (orange) tint so muscle
  // memory carries over.
  { symbol: 'O', tint: 'rgb(var(--mana-o))' },
];
