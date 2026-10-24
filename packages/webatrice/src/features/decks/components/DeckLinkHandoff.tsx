import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';

import { parseDeckUrl, type DeckProvider } from '../deckServices';

const PROVIDER_NAMES: Record<DeckProvider, string> = {
  archidekt: 'Archidekt',
  deckstats: 'Deckstats',
  moxfield: 'Moxfield',
  tappedout: 'TappedOut',
};

export function DeckLinkHandoff() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const link = url.trim() ? parseDeckUrl(url) : null;
  const provider = link ? PROVIDER_NAMES[link.provider] : '';

  return (
    <div>
      <label className="block">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          {t('DeckLink.label')}
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('DeckLink.placeholder')}
          className={[
            'mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
          ].join(' ')}
        />
      </label>
      {url.trim() && !link && (
        <p role="alert" className="mt-1 text-xs text-danger">{t('DeckLink.unsupported')}</p>
      )}
      {link && (
        <div className="mt-2 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
          <p>
            {t(link.handoffIsText ? 'DeckLink.copyText' : 'DeckLink.copyFromPage', { provider })}
          </p>
          <a
            href={link.handoffUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-accent hover:text-accent-hover"
          >
            <ExternalLink size={11} /> {t('DeckLink.open', { provider })}
          </a>
        </div>
      )}
    </div>
  );
}
