import { CardDTO, lookupCard } from '@app/services';

import { parseTableRow, type CardPlacementMeta, type PlayedCardMeta } from './cardPlacement';

export async function readCardPlacement(name: string): Promise<CardPlacementMeta & PlayedCardMeta> {
  const entry = await CardDTO.get(name).catch(() => undefined);
  if (entry) {
    const prop = entry.prop?.value ?? {};
    return {
      tableRow: parseTableRow(entry.tablerow?.value),
      typeLine: prop.type?.value,
      pt: prop.pt?.value || undefined,
      cipt: entry.cipt?.value === '1',
    };
  }
  const meta = await lookupCard(name).catch(() => undefined);
  return {
    tableRow: meta?.tableRow,
    typeLine: meta?.typeLine,
    pt: meta?.power != null && meta.toughness != null ? `${meta.power}/${meta.toughness}` : undefined,
    cipt: meta?.cipt,
  };
}
