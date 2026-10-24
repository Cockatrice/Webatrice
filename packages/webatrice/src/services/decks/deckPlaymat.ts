import { games } from '@cockatrice/datatrice';

export function readDeckPlaymat(xml: string | undefined): games.Playmat | null {
  if (!xml) {
    return null;
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const element = doc.documentElement;
  if (doc.querySelector('parsererror') || element.tagName !== 'playmatCard'
    || !(element.textContent || element.getAttribute('providerId'))) {
    return null;
  }
  const param = (key: keyof games.PlaymatParams) => {
    const value = element.getAttribute(key)?.trim();
    return value && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
      ? Number(value) : games.DEFAULT_PLAYMAT_PARAMS[key];
  };
  return {
    cardName: element.textContent ?? '',
    cardProviderId: element.getAttribute('providerId') ?? '',
    params: games.clampPlaymatParams({
      marginPctL: param('marginPctL'), marginPctR: param('marginPctR'),
      verticalOffset: param('verticalOffset'), zoom: param('zoom'),
    }),
  };
}

export function writeDeckPlaymat(playmat: games.Playmat | null): string | undefined {
  if (!playmat || !(playmat.cardName || playmat.cardProviderId)) {
    return undefined;
  }
  const doc = document.implementation.createDocument(null, 'playmatCard');
  const element = doc.documentElement;
  element.setAttribute('providerId', playmat.cardProviderId);
  const params = games.clampPlaymatParams(playmat.params);
  for (const key of ['marginPctL', 'marginPctR', 'verticalOffset', 'zoom'] as const) {
    element.setAttribute(key, params[key].toFixed(4));
  }
  element.textContent = playmat.cardName;
  return new XMLSerializer().serializeToString(element);
}
