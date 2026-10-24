import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ZoneName } from '@cockatrice/sockatrice';
import { games } from '@cockatrice/datatrice';
import { lookupCardsCached, type LookupResult } from '@app/services';
import { useAppSelector } from '@app/store';

import { useGameId } from '../components/ui/GameIdContext';
import { useGameSelectionState } from '../components/ui/GameSelectionContext';
import { parseCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { computeTally, type TallyCard, type TallyRow } from '../utils/tally';
import { useTallyType } from './useTallyType';

export interface SelectionTally {
  rows: TallyRow[];
  count: number;
}

function typeLineOf(result: LookupResult): string {
  const faces = result.faces?.map((f) => f.typeLine).filter((t): t is string => !!t) ?? [];
  if (faces.length > 1 && !result.typeLine?.includes(' // ')) {
    return faces.join(' // ');
  }
  return result.typeLine ?? '';
}

export function useSelectionTally(): SelectionTally {
  const { t } = useTranslation();
  const gameId = useGameId();
  const selection = useGameSelectionState();
  const [type] = useTallyType();
  const game = useAppSelector((state) => (gameId != null ? games.Selectors.getGame(state, gameId) : undefined));

  const selected = useMemo(() => {
    const out: (TallyCard & { battlefield: boolean })[] = [];
    for (const key of selection?.selectedCardKeys ?? []) {
      const parsed = parseCardKey(key);
      const zone = parsed ? game?.players[parsed.playerId]?.zones[parsed.zone] : undefined;
      const card = zone?.byId[parsed!.cardId] ?? zone?.revealedCards?.find((c) => c.id === parsed!.cardId);
      if (card) {
        out.push({ name: card.name, pt: card.pt, faceDown: card.faceDown, battlefield: parsed!.zone === ZoneName.TABLE });
      }
    }
    return out;
  }, [selection?.selectedCardKeys, game]);

  const namesKey = useMemo(
    () => (type === 'none' ? '' : Array.from(new Set(selected.map((c) => c.name).filter(Boolean))).sort().join('\n')),
    [selected, type],
  );
  const [catalog, setCatalog] = useState<Map<string, LookupResult>>(() => new Map());
  useEffect(() => {
    if (!namesKey) {
      return;
    }
    let cancelled = false;
    void lookupCardsCached(namesKey.split('\n')).then((results) => {
      if (!cancelled) {
        setCatalog(results);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [namesKey]);

  const rows = useMemo(() => {
    if (type === 'none') {
      return [];
    }
    const cards = selected.map((c) => {
      const printed = catalog.get(c.name);
      return c.battlefield && !c.pt && !c.faceDown && printed?.power != null && printed.toughness != null
        ? { ...c, pt: `${printed.power}/${printed.toughness}` }
        : c;
    });
    return computeTally(t, cards, type, (name) => {
      const result = catalog.get(name);
      return result ? typeLineOf(result) : undefined;
    });
  }, [selected, catalog, type, t]);

  return { rows, count: selection?.selectedCardKeys.size ?? 0 };
}
