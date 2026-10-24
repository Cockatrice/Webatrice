import { CardDTO, SetDTO } from '@app/services';

export interface CardPrinting {
  providerId: string;
  label: string;
}

export async function loadCardPrintings(cardName: string): Promise<CardPrinting[]> {
  const name = cardName.trim();
  if (!name) {
    return [];
  }
  const card = await CardDTO.get(name).catch(() => undefined);
  if (!card) {
    return [];
  }
  const sets = Array.isArray(card.set) ? card.set : [card.set];
  const printings: CardPrinting[] = [];
  for (const printing of sets) {
    if (!printing?.uuid) {
      continue;
    }
    const set = await SetDTO.get(printing.value).catch(() => undefined);
    const setName = set?.longname?.value || printing.value;
    printings.push({
      providerId: printing.uuid,
      label: printing.num ? `${setName} #${printing.num}` : setName,
    });
  }
  return printings;
}
