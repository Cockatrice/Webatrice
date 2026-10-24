
import type { MenuShortcut } from '@app/feature-widgets/shortcuts';
import type { LookupCardFace, LookupResult, RelatedCardRef } from '@app/services';
import type { TFunction } from 'i18next';

import type { CreateTokenRequest } from '../../ui/PlayerBoard/playerBoard.types';
import type { ContextMenuItem } from '../ContextMenu/ContextMenu';

export function buildRelatedViewItems(
  t: TFunction,
  related: readonly RelatedCardRef[],
  resolvable: (name: string) => boolean,
  onView: (ref: RelatedCardRef) => void,
): ContextMenuItem[] {
  if (!related.some((ref) => resolvable(ref.name))) {
    return [];
  }
  return [
    { divider: true },
    {
      label: t('CardMenu.viewRelated'),
      submenu: related.map((ref) => ({ label: ref.name, onClick: () => onView(ref) })),
    },
  ];
}

interface RelatedTokenAction {
  label: (t: TFunction) => string;
  requests: CreateTokenRequest[];
}

const isSet = (attribute: string | undefined): boolean => attribute !== undefined;

function relatedTokenAction(ref: RelatedCardRef, tok: LookupResult | undefined, annotate: boolean): RelatedTokenAction {
  const tokPT = tok?.power != null && tok.toughness != null
    ? `${tok.power}/${tok.toughness}`
    : undefined;
  const tokColor = tok?.colors && tok.colors.length > 0
    ? tok.colors.length > 1
      ? 'm'
      : tok.colors[0].toLowerCase()
    : '';
  const tokProviderId = tok?.pinnedPrintingId ?? '';
  const countPrefix = ref.count === 'x'
    ? 'X '
    : ref.count && /^\d+$/.test(ref.count) && Number(ref.count) > 1
      ? `${ref.count}x `
      : '';
  const ptPart = tokPT ? `${tokPT} ` : '';
  const { variable, count } = relationCount(ref);
  const fireCount = variable ? 1 : count;
  const request: CreateTokenRequest = {
    name: tok?.name ?? ref.name,
    color: tokColor,
    pt: tokPT ?? '',
    annotation: annotate ? tok?.text ?? '' : '',
    destroyOnZoneChange: !isSet(ref.persistent),
    faceDown: false,
    providerId: tokProviderId,
  };
  return {
    label: (t) => t('CardMenu.token', { description: `${countPrefix}${ptPart}${ref.name}` }),
    requests: Array.from({ length: fireCount }, () => request),
  };
}

const actionItem = (t: TFunction, action: RelatedTokenAction, onCreateToken: CreateTokenHandler | undefined): ContextMenuItem => ({
  label: action.label(t),
  onClick: () => {
    if (onCreateToken) {
      action.requests.forEach((request) => onCreateToken(request));
    }
  },
});

export function buildRelatedTokenItems(
  t: TFunction,
  related: readonly RelatedCardRef[],
  tokenMeta: ReadonlyMap<string, LookupResult>,
  onCreateToken: CreateTokenHandler | undefined,
  annotate = false,
): ContextMenuItem[] {
  return related.map((ref) => actionItem(t, relatedTokenAction(ref, tokenMeta.get(ref.name), annotate), onCreateToken));
}

export type CreateTokenHandler = (request: CreateTokenRequest) => void;

/**
 * Scryfall layouts we treat as transformable (present two physical
 * faces the user can flip between via Command_CreateToken.
 * TRANSFORM_INTO). Adventure / split / flip layouts DON'T qualify —
 * they have two "faces" in the data model but the physical card
 * doesn't flip in play. Reversible cards (Zendikar Rising) DO
 * qualify: both faces are legal at once and the player can decide
 * which one is "up."
 */
const TRANSFORMABLE_LAYOUTS = new Set(['transform', 'modal_dfc', 'reversible_card']);

type TransformMeta = { layout?: string; faces?: LookupCardFace[] } | undefined;

function transformAction(
  parentMeta: TransformMeta,
  sourceCardId: number | undefined,
  parentName: string,
  annotate: boolean,
): RelatedTokenAction | null {
  if (!parentMeta || sourceCardId == null) {
    return null;
  }
  if (!parentMeta.layout || !TRANSFORMABLE_LAYOUTS.has(parentMeta.layout)) {
    return null;
  }
  const faces = parentMeta.faces ?? [];
  if (faces.length < 2) {
    return null;
  }
  // Determine which face is currently showing. Simplest heuristic:
  // Scryfall's `card_faces[0]` is the front. The parent card's
  // display name here is `parentName` (whichever face the server
  // currently reports); if it matches the front-face name, target
  // the back. Otherwise target the front. Handles the case where
  // an already-transformed card should flip back.
  const front = faces[0];
  const back = faces[1];
  const target = parentName === front.name ? back : front;
  const targetPT = target.power != null && target.toughness != null
    ? `${target.power}/${target.toughness}`
    : undefined;
  const targetColor = target.colors && target.colors.length > 0
    ? target.colors.length > 1
      ? 'm'
      : target.colors[0].toLowerCase()
    : '';
  return {
    label: (t) => t('CardMenu.transform', { name: target.name }),
    requests: [{
      name: target.name,
      color: targetColor,
      pt: targetPT ?? '',
      annotation: annotate ? target.text ?? '' : '',
      destroyOnZoneChange: false,
      faceDown: false,
      targetCardId: sourceCardId,
      targetMode: 'transform_into',
    }],
  };
}

export function buildTransformItems(
  t: TFunction,
  parentMeta: TransformMeta,
  sourceCardId: number | undefined,
  parentName: string,
  onCreateToken: CreateTokenHandler | undefined,
  annotate = false,
): ContextMenuItem[] {
  const action = onCreateToken ? transformAction(parentMeta, sourceCardId, parentName, annotate) : null;
  return action ? [actionItem(t, action, onCreateToken)] : [];
}

export interface RelatedCardSource {
  related: readonly RelatedCardRef[];
  tokenMeta: ReadonlyMap<string, LookupResult>;
  parentMeta: TransformMeta;
  sourceCardId: number | undefined;
  parentName: string;
  annotate?: boolean;
}

export function relationCount(ref: Pick<RelatedCardRef, 'count'>): { variable: boolean; count: number } {
  const raw = ref.count;
  if (raw == null) {
    return { variable: false, count: 1 };
  }
  const variable = raw.startsWith('x');
  const parsed = parseInt(raw.startsWith('x=') ? raw.slice(2) : variable ? '' : raw, 10);
  return { variable, count: Number.isFinite(parsed) && parsed >= 1 ? parsed : 1 };
}

export interface CreateAllRelated {
  requests: CreateTokenRequest[];
  prompt?: { request: CreateTokenRequest; defaultCount: number };
  lastToken?: CreateTokenRequest;
}

function repeatTokenRequest(ref: RelatedCardRef, tok: LookupResult | undefined, annotate: boolean): CreateTokenRequest {
  return {
    name: tok?.name ?? ref.name,
    color: tok?.colors?.[0]?.toLowerCase() ?? '',
    pt: tok?.power != null && tok.toughness != null ? `${tok.power}/${tok.toughness}` : '',
    annotation: annotate ? tok?.text ?? '' : '',
    destroyOnZoneChange: true,
    faceDown: false,
    providerId: tok?.pinnedPrintingId ?? '',
  };
}

export function createAllRelated(source: RelatedCardSource): CreateAllRelated {
  const annotate = source.annotate ?? false;
  const repeatToken = (ref: RelatedCardRef) => repeatTokenRequest(ref, source.tokenMeta.get(ref.name), annotate);
  const runOne = (ref: RelatedCardRef): CreateAllRelated => {
    const { requests } = relatedTokenAction(ref, source.tokenMeta.get(ref.name), annotate);
    const { variable, count } = relationCount(ref);
    const lastToken = isSet(ref.attach) ? undefined : repeatToken(ref);
    return variable
      ? { requests: [], prompt: { request: requests[0], defaultCount: count }, lastToken }
      : { requests, lastToken };
  };
  const createEach = (refs: readonly RelatedCardRef[]): CreateAllRelated => {
    const created = refs.filter((ref) => !isSet(ref.attach) && !relationCount(ref).variable);
    return {
      requests: created.flatMap((ref) => relatedTokenAction(ref, source.tokenMeta.get(ref.name), annotate).requests),
      lastToken: created.length > 0 ? repeatToken(created[0]) : undefined,
    };
  };

  const transform = transformAction(source.parentMeta, source.sourceCardId, source.parentName, annotate);
  if (source.related.length + (transform ? 1 : 0) === 1) {
    return transform ? { requests: transform.requests } : runOne(source.related[0]);
  }
  const nonExcluded = source.related.filter((ref) => !isSet(ref.exclude) && !isSet(ref.attach));
  if (nonExcluded.length === 1) {
    return runOne(nonExcluded[0]);
  }
  return createEach(nonExcluded.length === 0 ? source.related : nonExcluded);
}

export function buildRelatedActionItems(
  t: TFunction,
  source: RelatedCardSource,
  onCreateToken: CreateTokenHandler | undefined,
  createAllShortcut: MenuShortcut,
  onCreateAll: () => void,
): ContextMenuItem[] {
  const items = [
    ...buildRelatedTokenItems(t, source.related, source.tokenMeta, onCreateToken, source.annotate),
    ...buildTransformItems(t, source.parentMeta, source.sourceCardId, source.parentName, onCreateToken, source.annotate),
  ];
  const shortcut = createAllShortcut.shortcut ? createAllShortcut : null;
  if (items.length === 1) {
    return [{ ...items[0], ...shortcut, onClick: onCreateAll }];
  }
  if (items.length === 0) {
    return items;
  }
  return [
    ...items,
    {
      label: t('CardMenu.allTokens'),
      ...shortcut,
      onClick: onCreateAll,
    },
  ];
}
