import { useTranslation } from 'react-i18next';
import { Swords } from 'lucide-react';
import type { ReactNode } from 'react';

import { GAME_LINK_REGEX, containsGameLink, parseGameJoinLink } from '@app/utils';

import { requestGameLinkJoin } from './gameLinkRequests';

interface GameLinkButtonProps {
  url: string;
}

export function GameLinkButton({ url }: GameLinkButtonProps) {
  const { t } = useTranslation();
  const parsed = parseGameJoinLink(url);
  let label = t('GameLink.anchor.plain');
  if (parsed.ok && parsed.link.gameId > 0) {
    const { gameId, hostname, description } = parsed.link;
    label = description
      ? t('GameLink.anchor.withDescription', { description, gameId, hostname })
      : t('GameLink.anchor.withId', { gameId, hostname });
  }
  return (
    <button
      type="button"
      onClick={() => requestGameLinkJoin(url)}
      title={url}
      className={[
        'inline-flex items-center gap-1 px-1.5 rounded align-baseline font-semibold',
        'text-text-link bg-text-link/10 hover:bg-text-link/20 transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      ].join(' ')}
    >
      <Swords size={12} className="shrink-0" />
      {label}
    </button>
  );
}

export function renderGameLinks(text: string): ReactNode[] {
  if (!containsGameLink(text)) {
    return [text];
  }
  return text
    .split(GAME_LINK_REGEX)
    .filter((part) => part !== '')
    .map((part, index) => (containsGameLink(part) ? <GameLinkButton key={index} url={part} /> : part));
}
