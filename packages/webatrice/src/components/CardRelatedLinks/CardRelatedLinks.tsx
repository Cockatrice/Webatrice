import { useState } from 'react';
import { ArrowRightLeft, ChevronDown, ChevronRight, Loader2, Puzzle, Sparkles, Users } from 'lucide-react';

/**
 * Clickable links to a card's related printings — the front/back faces
 * of a DFC / transform / adventure / flip card AND the tokens, meld
 * pieces, and combo pieces surfaced by Scryfall's `all_parts` array.
 *
 * Mirrors Cockatrice's CardInfoWidget behavior: at the bottom of the
 * card details it shows every related card as a clickable link that
 * swaps the widget's displayed card. We render the same in all three
 * of webatrice's card-detail surfaces (right-rail preview,
 * middle-click zoom, deck-editor modal) so users have one consistent
 * mental model.
 *
 * `faces` and `allParts` come from Scryfall's `/cards/:id` response
 * (`card_faces` and `all_parts`). Each surface may narrow the shape
 * differently, so we accept a minimal duck-typed contract rather than
 * importing a shared interface.
 */
export interface CardRelatedLinksFace {
  name?: string;
}
export interface CardRelatedLinksPart {
  id?: string;
  name?: string;
  component?: string;
  /** `"related"` on the parent card entry itself. Scryfall lists the
   *  parent alongside its parts; we filter that entry out via the
   *  `parentName` prop. */
  type_line?: string;
}

/** How the linked card relates to the parent. Callers use this to
 *  decide UX affordances downstream — e.g. the deck editor's
 *  CardDetailModal hides its "Add to deck" button for `'face'`
 *  (same physical card, no separate row) and `'meld_result'` (the
 *  representation of a completed meld — not a card you own or
 *  shuffle in) but shows it for `'token'`, `'combo_piece'`, and
 *  `'meld_part'` (the OTHER card that completes the meld, which IS
 *  a deckable card). */
export type RelatedCardKind = 'face' | 'token' | 'meld_part' | 'meld_result' | 'combo_piece';

export interface NavigatedCard {
  name: string;
  scryfallId?: string;
  kind: RelatedCardKind;
}

/** Build the pending-key for a linked card. Kept as an exported
 *  helper so parents that fetch-before-swap can generate the same
 *  key without duplicating the shape. Matches by name (lowercased)
 *  + scryfallId so tokens and faces with the same name don't
 *  collide with each other. */
export function relatedCardKey(card: { name: string; scryfallId?: string }): string {
  return `${card.name.toLowerCase()}|${card.scryfallId ?? ''}`;
}

export function CardRelatedLinks({
  faces,
  allParts,
  parentName,
  parentTypeLine,
  currentFaceName,
  onNavigate,
  pendingKey,
}: {
  faces?: readonly CardRelatedLinksFace[];
  allParts?: readonly CardRelatedLinksPart[];
  /** Top-level card name — used to filter out the card's own entry
   *  from `allParts` (Scryfall lists the parent alongside its parts,
   *  which would otherwise render as a link back to the same card). */
  parentName?: string;
  /** Top-level type line — used to detect when the parent card is a
   *  token. Scryfall's `all_parts` is bidirectional: a token's
   *  `all_parts` lists every card that creates or references it
   *  (dozens for Food / Treasure / Clue), plus other tokens that
   *  share a creator. That's noise for the sidebar preview, so we
   *  collapse those sections behind a "Show cards that use this
   *  token" toggle when the parent is a token. Real cards keep
   *  their small forward-facing lists visible by default. */
  parentTypeLine?: string;
  /** Name of the face currently shown. Used to filter out that face
   *  from the "Other face" list — no point offering to switch to the
   *  face already displayed. Case-insensitive match. */
  currentFaceName?: string;
  onNavigate: (card: NavigatedCard) => void;
  /** When set, the chip whose key matches shows a spinner and every
   *  chip is disabled — used by parents that fetch the target card's
   *  details before swapping the preview, avoiding the mid-swap
   *  flicker. Match key is `relatedCardKey({ name, scryfallId })`. */
  pendingKey?: string;
}) {
  // "Token" appears in every token's type_line (Scryfall convention:
  // "Token Artifact — Food", "Token Creature — 1/1 Boar"). Match on
  // the space-delimited word so we don't false-positive real cards
  // that happen to contain "token" in their name/text.
  const parentIsToken = /\btoken\b/i.test(parentTypeLine ?? '');
  const [reverseExpanded, setReverseExpanded] = useState(false);
  const anyPending = !!pendingKey;
  // Bucket `allParts` by component so we can render each group under
  // its own header. Filters:
  //   - drop the parent card itself (Scryfall includes it in all_parts)
  //   - drop entries missing a name (can't render / navigate)
  const otherFaces = (faces ?? [])
    .filter((f) => !!f.name)
    .filter((f) => f.name?.toLowerCase() !== currentFaceName?.toLowerCase());
  const tokens: CardRelatedLinksPart[] = [];
  const meldPieces: CardRelatedLinksPart[] = [];
  const comboPieces: CardRelatedLinksPart[] = [];
  for (const part of allParts ?? []) {
    if (!part.name) continue;
    if (parentName && part.name.toLowerCase() === parentName.toLowerCase()) continue;
    // Skip Scryfall's checklist entries — Wizards printed physical
    // "checklist cards" as tokens for pre-M15 DFC sets and Scryfall
    // lists them in `all_parts`. They're not real gameplay tokens
    // and clutter the Related section (e.g. Delver of Secrets shows
    // a "Checklist Card" alongside Insectile Aberration). Match on
    // either the name or type_line so we catch both naming
    // variations Scryfall uses.
    const nameLower = part.name.toLowerCase();
    const typeLower = (part.type_line ?? '').toLowerCase();
    if (nameLower.includes('checklist') || typeLower.includes('checklist')) {
      continue;
    }
    switch (part.component) {
      case 'token':
        tokens.push(part);
        break;
      case 'meld_part':
      case 'meld_result':
        meldPieces.push(part);
        break;
      case 'combo_piece':
        comboPieces.push(part);
        break;
      // Unknown component → skip; Scryfall may add new kinds in
      // future and we'd rather render nothing than something wrong.
    }
  }

  // `tokens` is hidden when the parent is itself a token (see render
  // below), so exclude it from the "anything to show" gate in that
  // case — otherwise we'd render the wrapping border for an empty panel.
  const visibleTokenCount = parentIsToken ? 0 : tokens.length;
  if (
    otherFaces.length === 0
    && visibleTokenCount === 0
    && meldPieces.length === 0
    && comboPieces.length === 0
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-2 text-xs">
      {otherFaces.length > 0 && (
        <Section
          icon={<ArrowRightLeft size={11} className="text-text-muted" />}
          label="Other face"
        >
          {otherFaces.map((f, i) => {
            const key = relatedCardKey({ name: f.name! });
            return (
              <LinkChip
                key={`face-${i}`}
                label={f.name!}
                loading={pendingKey === key}
                disabled={anyPending}
                onClick={() => onNavigate({ name: f.name!, kind: 'face' })}
              />
            );
          })}
        </Section>
      )}
      {/* Forward-facing "this card creates X token" list — always
       *  visible for real cards (small, useful). Suppressed entirely
       *  when the parent is itself a token; Scryfall's bidirectional
       *  graph would surface unrelated sibling tokens (e.g. Boar
       *  showing under Food because some card creates both), which
       *  reads as noise. Users looking at a token still see what
       *  cards create it via the collapsible "reverse related"
       *  section below. */}
      {tokens.length > 0 && !parentIsToken && (
        <Section
          icon={<Sparkles size={11} className="text-text-muted" />}
          label={tokens.length === 1 ? 'Token' : 'Tokens'}
        >
          {tokens.map((t, i) => {
            const key = relatedCardKey({ name: t.name!, scryfallId: t.id });
            return (
              <LinkChip
                key={`tok-${i}`}
                label={t.name!}
                loading={pendingKey === key}
                disabled={anyPending}
                onClick={() => onNavigate({ name: t.name!, scryfallId: t.id, kind: 'token' })}
              />
            );
          })}
        </Section>
      )}
      {meldPieces.length > 0 && (
        <Section
          icon={<Puzzle size={11} className="text-text-muted" />}
          label="Meld"
        >
          {meldPieces.map((m, i) => {
            const key = relatedCardKey({ name: m.name!, scryfallId: m.id });
            return (
              <LinkChip
                key={`meld-${i}`}
                label={m.name!}
                loading={pendingKey === key}
                disabled={anyPending}
                onClick={() => onNavigate({
                  name: m.name!,
                  scryfallId: m.id,
                  // meld_part = the OTHER real card that completes the meld
                  //   → deckable → Add button visible
                  // meld_result = the visual representation of the merged
                  //   creature → not a real deck-shufflable card → no Add
                  kind: m.component === 'meld_result' ? 'meld_result' : 'meld_part',
                })}
              />
            );
          })}
        </Section>
      )}
      {/* Combo / referenced cards. For a real card, this list is
       *  usually short and directly useful (Squire ↔ Rebel, meld
       *  pairs cross-referenced, etc.). For a token, Scryfall's
       *  graph pushes every card that produces or references this
       *  token into this bucket — 40+ chips for Food / Treasure /
       *  Clue is common. Collapse behind a toggle in that case so
       *  the info is still reachable without blowing out the panel. */}
      {comboPieces.length > 0 && (
        parentIsToken ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setReverseExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors self-start"
            >
              {reverseExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <Users size={11} />
              {`Cards that use this token (${comboPieces.length})`}
            </button>
            {reverseExpanded && (
              <div className="flex flex-wrap gap-1">
                {comboPieces.map((c, i) => {
                  const key = relatedCardKey({ name: c.name!, scryfallId: c.id });
                  return (
                    <LinkChip
                      key={`combo-${i}`}
                      label={c.name!}
                      loading={pendingKey === key}
                      disabled={anyPending}
                      onClick={() => onNavigate({ name: c.name!, scryfallId: c.id, kind: 'combo_piece' })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Section
            icon={<Users size={11} className="text-text-muted" />}
            label="Related"
          >
            {comboPieces.map((c, i) => {
              const key = relatedCardKey({ name: c.name!, scryfallId: c.id });
              return (
                <LinkChip
                  key={`combo-${i}`}
                  label={c.name!}
                  loading={pendingKey === key}
                  disabled={anyPending}
                  onClick={() => onNavigate({ name: c.name!, scryfallId: c.id, kind: 'combo_piece' })}
                />
              );
            })}
          </Section>
        )
      )}
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function LinkChip({
  label,
  onClick,
  loading = false,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  // `disabled` retained in the caller signature for backward
  // compatibility but intentionally not read — the parent's pending
  // ref already guards against stale fetches, so leaving all chips
  // clickable lets the user redirect to a different card mid-fetch
  // instead of watching a wait cursor.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Only the loading chip is `disabled` so the same chip can't be
      // fired twice back-to-back; siblings stay clickable so the user
      // can redirect. No cursor override — hover cursor stays normal
      // on non-loading chips.
      disabled={loading}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border-subtle bg-bg-elevated text-text-primary text-xs transition-colors hover:bg-border-subtle hover:text-accent cursor-pointer disabled:opacity-80"
    >
      {loading && <Loader2 size={10} className="animate-spin" />}
      {label}
    </button>
  );
}
