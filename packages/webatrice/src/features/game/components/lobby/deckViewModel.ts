import { validateCod } from '@app/services';
import { DECK_ZONE_MAIN, DECK_ZONE_SIDE } from '@app/types';

export type DeckZone = typeof DECK_ZONE_MAIN | typeof DECK_ZONE_SIDE;

export interface SideboardPlanMove {
  cardName: string;
  startZone: string;
  targetZone: string;
}

export interface DeckViewCard {
  key: number;
  name: string;
  originZone: DeckZone;
}

export interface DeckView {
  main: DeckViewCard[];
  side: DeckViewCard[];
}

export interface ParsedDeckView {
  view: DeckView;
  currentPlan: SideboardPlanMove[];
}

const CURRENT_SIDEBOARD_PLAN_NAME = '';

function directChildren(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter((c) => c.tagName === tagName);
}

function childText(parent: Element, tagName: string): string {
  return directChildren(parent, tagName)[0]?.textContent ?? '';
}

function isDeckZone(zone: string): zone is DeckZone {
  return zone === DECK_ZONE_MAIN || zone === DECK_ZONE_SIDE;
}

export function parseDeckView(xml: string): ParsedDeckView | null {
  if (!xml) {
    return null;
  }
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  const root = dom.documentElement;
  if (!validateCod(dom)) {
    return null;
  }

  const view: DeckView = { main: [], side: [] };
  let key = 0;
  for (const zoneEl of directChildren(root, 'zone')) {
    const zone = zoneEl.getAttribute('name') ?? '';
    if (!isDeckZone(zone)) {
      continue;
    }
    for (const cardEl of directChildren(zoneEl, 'card')) {
      const name = (cardEl.getAttribute('name') ?? cardEl.textContent ?? '').trim();
      const count = Number.parseInt(cardEl.getAttribute('number') ?? '1', 10);
      if (!name || !Number.isFinite(count)) {
        continue;
      }
      for (let i = 0; i < count; i++) {
        view[zone].push({ key: key++, name, originZone: zone });
      }
    }
  }

  const currentPlan: SideboardPlanMove[] = [];
  for (const planEl of directChildren(root, 'sideboard_plan')) {
    if (childText(planEl, 'name') !== CURRENT_SIDEBOARD_PLAN_NAME) {
      continue;
    }
    for (const moveEl of directChildren(planEl, 'move_card_to_zone')) {
      currentPlan.push({
        cardName: childText(moveEl, 'card_name'),
        startZone: childText(moveEl, 'start_zone'),
        targetZone: childText(moveEl, 'target_zone'),
      });
    }
  }

  return { view, currentPlan };
}

export function applySideboardPlan(view: DeckView, plan: ReadonlyArray<SideboardPlanMove>): DeckView {
  const next: DeckView = { main: [...view.main], side: [...view.side] };
  for (const move of plan) {
    if (!isDeckZone(move.startZone) || !isDeckZone(move.targetZone)) {
      continue;
    }
    const start = next[move.startZone];
    const idx = start.findIndex((card) => card.name === move.cardName);
    if (idx < 0) {
      continue;
    }
    const [card] = start.splice(idx, 1);
    next[move.targetZone].push(card);
  }
  return next;
}

export function getSideboardPlan(view: DeckView): SideboardPlanMove[] {
  const plan: SideboardPlanMove[] = [];
  for (const zone of [DECK_ZONE_MAIN, DECK_ZONE_SIDE] as const) {
    for (const card of view[zone]) {
      if (card.originZone !== zone) {
        plan.push({ cardName: card.name, startZone: card.originZone, targetZone: zone });
      }
    }
  }
  return plan;
}

export function otherDeckZone(zone: DeckZone): DeckZone {
  return zone === DECK_ZONE_MAIN ? DECK_ZONE_SIDE : DECK_ZONE_MAIN;
}

export interface DeckViewGroup {
  name: string;
  count: number;
}

export function groupDeckZone(cards: ReadonlyArray<DeckViewCard>): DeckViewGroup[] {
  const groups = new Map<string, DeckViewGroup>();
  for (const card of cards) {
    const group = groups.get(card.name);
    if (group) {
      group.count += 1;
    } else {
      groups.set(card.name, { name: card.name, count: 1 });
    }
  }
  return [...groups.values()];
}
