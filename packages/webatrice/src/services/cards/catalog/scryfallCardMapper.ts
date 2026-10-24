import type { ScryfallCard } from '../../scryfall/types';
import type { LookupCardFace, LookupResult, RelatedCardRef } from './types';

export function scryfallToLookup(card: ScryfallCard): LookupResult {
  // Extract related-card refs from Scryfall's `all_parts`. Filter to
  // `token` + `meld_part` + `meld_result` — these three components
  // have well-defined semantics (Scryfall creates them from the
  // card's rules text automatically and consistently).
  //
  // `combo_piece` is DELIBERATELY excluded: Scryfall's docs call it
  // "the specific relationship is unclear" and it doubles as a
  // grab-bag for any pair of cards that reference each other by
  // name. That produces false positives like Command Tower listing
  // Tower Winder as a related token (Tower Winder's text says
  // "search your library for Command Tower", so Scryfall bidir-
  // linked them). Cockatrice avoids this by pulling relations from
  // human-curated cards.xml `<related>` entries; we still honor
  // those via dexieToLookup, so users with cards.xml imported get
  // the curated transform/meld back-faces there. Users on pure
  // Scryfall lose transform-back-face menu items (Delver → Insectile
  // Aberration) but gain accuracy — false positives are worse than
  // missing niche entries.
  //
  // DFC front/back doesn't live in `all_parts` anyway — Scryfall
  // puts both faces in the parent card's `card_faces` array. That's
  // a separate concern from token creation.
  const relatedList: RelatedCardRef[] = [];
  if (card.all_parts) {
    const seen = new Set<string>();
    for (const part of card.all_parts) {
      if (
        !part.name
        || part.name === card.name
        || seen.has(part.name)
        || part.component === 'combo_piece'
      ) {
        continue;
      }
      seen.add(part.name);
      relatedList.push({
        name: part.name,
        component: part.component,
        origin: 'scryfall',
        scryfallId: part.id,
      });
    }
  }

  // Extract each face for multi-faced cards. Skips entries missing
  // a name (defensive — Scryfall always sets it for DFCs, but split
  // cards / adventures sometimes have partial face records).
  const faces: LookupCardFace[] | undefined = card.card_faces
    ? card.card_faces
      .filter((f) => !!f.name)
      .map((f) => ({
        name: f.name!,
        manaCost: f.mana_cost,
        typeLine: f.type_line,
        colors: f.colors,
        power: f.power,
        toughness: f.toughness,
        text: f.oracle_text,
        imageUri: f.image_uris?.normal ?? f.image_uris?.small,
      }))
    : undefined;

  return {
    found: true,
    source: 'scryfall',
    name: card.name,
    typeLine: card.type_line,
    manaCost: card.mana_cost,
    cmc: card.cmc,
    colors: card.colors && card.colors.length ? card.colors : card.color_identity,
    colorIdentity: card.color_identity,
    power: card.power,
    toughness: card.toughness,
    printings: [
      {
        set: card.set,
        collectorNumber: card.collector_number,
        scryfallId: card.id,
        imageUri:
          card.image_uris?.normal ??
          card.image_uris?.small ??
          card.card_faces?.[0]?.image_uris?.normal ??
          card.card_faces?.[0]?.image_uris?.small,
      },
    ],
    related: relatedList.length > 0 ? relatedList : undefined,
    layout: card.layout,
    faces: faces && faces.length > 0 ? faces : undefined,
    text: card.oracle_text ?? card.card_faces?.map((f) => f.oracle_text ?? '').join('\n//\n'),
    landscape: isLandscapeLayout(card.layout, card.type_line) || undefined,
    properties: card.type_line ? { type: card.type_line } : undefined,
    legalities: scryfallLegalities(card.legalities),
  };
}

function isLandscapeLayout(layout: string | undefined, typeLine: string | undefined): boolean {
  return layout === 'split' || layout === 'planar' || /\bBattle\b/.test(typeLine ?? '');
}

function scryfallLegalities(legalities: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!legalities) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [format, label] of Object.entries(legalities)) {
    if (label !== 'not_legal') {
      out[format] = label;
    }
  }
  return out;
}
