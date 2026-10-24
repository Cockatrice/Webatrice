import type { ReactNode } from 'react';

import type { Game, Room } from '@cockatrice/datatrice';

export type RenderGameCard = (room: Room, game: Game) => ReactNode;

export default function GameGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-gap">{children}</ul>;
}
