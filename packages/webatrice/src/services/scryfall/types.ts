export interface ScryfallCard {
  id: string;
  name: string;
  layout?: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  set?: string;
  collector_number?: string;
  image_uris?: { small?: string; normal?: string; large?: string };
  oracle_text?: string;
  legalities?: Record<string, string>;
  /** Present on multi-faced cards (transform, modal_dfc,
   *  reversible_card, split, adventure, flip). Front-face is [0],
   *  back-face is [1]. Fields on each face largely mirror the
   *  top-level fields — for DFCs, top-level `name` is combined
   *  "A // B" while each face has its own single-face name. */
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    colors?: string[];
    power?: string;
    toughness?: string;
    oracle_text?: string;
    image_uris?: { small?: string; normal?: string };
  }>;
  all_parts?: Array<{
    id: string;
    component: 'token' | 'meld_part' | 'meld_result' | 'combo_piece';
    name: string;
    type_line?: string;
    uri: string;
  }>;
}

export interface ScryfallIdentifier {
  id?: string;
  name?: string;
  set?: string;
  collector_number?: string;
}

export interface ScryfallCardHint {
  name: string;
  scryfallId?: string;
  set?: string;
  collectorNumber?: string;
}
