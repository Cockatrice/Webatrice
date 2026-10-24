import type { DeckCard } from './types';

export function readDeckTags(tagsXml: string | undefined): string[] {
  const root = parseTags(tagsXml);
  if (!root) {
    return [];
  }
  return Array.from(root.children)
    .filter((el) => el.tagName === 'tag')
    .map((el) => el.textContent ?? '')
    .filter((tag) => tag.length > 0);
}

export function writeDeckTags(tagsXml: string | undefined, tags: readonly string[]): string | undefined {
  const root = parseTags(tagsXml) ?? new DOMParser().parseFromString('<tags/>', 'application/xml').documentElement;
  const doc = root.ownerDocument;
  for (const el of Array.from(root.children)) {
    if (el.tagName === 'tag') {
      root.removeChild(el);
    }
  }
  for (const tag of tags) {
    const el = doc.createElement('tag');
    el.textContent = tag;
    root.appendChild(el);
  }
  if (root.children.length === 0) {
    return undefined;
  }
  return new XMLSerializer().serializeToString(root);
}

function parseTags(tagsXml: string | undefined): Element | null {
  if (!tagsXml?.trim()) {
    return null;
  }
  const doc = new DOMParser().parseFromString(tagsXml, 'application/xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root?.tagName !== 'tags') {
    return null;
  }
  return root;
}

export type TagValidation = 'ok' | 'empty' | 'duplicate';

export function validateNewTag(tag: string, current: readonly string[]): TagValidation {
  const trimmed = tag.trim();
  if (!trimmed) {
    return 'empty';
  }
  return current.includes(trimmed) ? 'duplicate' : 'ok';
}

export function tagSuggestions(active: readonly string[], known: readonly string[] = []): string[] {
  const seen = new Set(active);
  const out: string[] = [];
  for (const tag of [...DEFAULT_DECK_TAGS, ...known]) {
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

export interface BannerCandidate {
  name: string;
  providerId?: string;
}

export function bannerCandidates(cards: readonly DeckCard[]): BannerCandidate[] {
  const byKey = new Map<string, BannerCandidate>();
  for (const card of cards) {
    const key = `${card.name}\u0000${card.scryfallId ?? ''}`;
    if (!byKey.has(key)) {
      byKey.set(key, { name: card.name, providerId: card.scryfallId });
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const DEFAULT_DECK_TAGS: readonly string[] = [
  '🏃️ Aggro', '🧙‍️ Control', '⚔️ Midrange', '🌀 Combo', '🪓 Mill', '🔒 Stax', '🗺️ Landfall', '🛡️ Pillowfort',
  '🌱 Ramp', '⚡ Storm', '💀 Aristocrats', '☠️ Reanimator', '👹 Sacrifice', '🔥 Burn', '🌟 Lifegain',
  '🔮 Spellslinger', '👥 Tokens', '🎭 Blink', '⏳ Time Manipulation', '🌍 Domain', '💫 Proliferate', '📜 Saga',
  '🎲 Chaos', '🪄 Auras', '🔫 Pingers',
  '👑 Monarch', '🚀 Vehicles', '💉 Infect', '🩸 Madness', '🌀 Morph',
  '⚔️ Creature', '💎 Artifact', '🌔 Enchantment', '📖 Sorcery', '⚡ Instant', '🌌 Planeswalker', '🌏 Land', '🪄 Aura',
  '🐉 Kindred', '🧙 Humans', '⚔️ Soldiers', '🛡️ Knights', '🎻 Bards', '🧝 Elves', '🌲 Dryads', '😇 Angels',
  '🎩 Wizards', '🧛 Vampires', '🦴 Skeletons', '💀 Zombies', '👹 Demons', '👾 Eldrazi', '🐉 Dragons', '🐠 Merfolk',
  '🦁 Cats', '🐺 Wolves', '🐺 Werewolves', '🦇 Bats', '🐀 Rats', '🦅 Birds', '🦗 Insects', '🍄 Fungus',
  '🐚 Sea Creatures', '🐗 Boars', '🦊 Foxes', '🦄 Unicorns', '🐘 Elephants', '🐻 Bears', '🦏 Rhinos', '🦂 Scorpions',
];
