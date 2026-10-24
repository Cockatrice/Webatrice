import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';

import type { ServerInfo_DeckShareSummary } from '@cockatrice/sockatrice/generated';

import { formatShareExpiry } from '../deckSharing';
import { DeckDialogFrame } from './DeckDialogFrame';

export interface DeckShareLinksDialogProps {
  shares: ServerInfo_DeckShareSummary[] | null;
  error: string | null;
  pending?: boolean;
  onRevoke: (shareId: number) => void;
  onClose: () => void;
}

export function DeckShareLinksDialog({ shares, error, pending = false, onRevoke, onClose }: DeckShareLinksDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [confirming, setConfirming] = useState<ServerInfo_DeckShareSummary | null>(null);
  const close = () => {
    if (!pending) {
      onClose();
    }
  };
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = confirmRef.current;
    button?.scrollIntoView?.({ block: 'nearest' });
    button?.focus();
  }, [confirming]);

  return (
    <DeckDialogFrame onClose={close} titleId={titleId} onEscape={confirming ? () => setConfirming(null) : close}>
      <div
        className="relative w-full max-w-lg rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('DeckShareLinks.title')}</h2>
        </div>
        <div className="px-5 py-4 text-sm text-text-secondary space-y-3 max-h-[60vh] overflow-y-auto">
          {error && <p role="alert" className="text-danger">{error}</p>}
          {!shares && !error && <p role="status">{t('DeckShareLinks.loading')}</p>}
          {shares?.length === 0 && <p>{t('DeckShareLinks.none')}</p>}
          {shares && shares.length > 0 && (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-text-primary truncate">{share.name}</div>
                    <div className="text-xs text-text-muted">
                      {t('DeckShareLinks.summary', {
                        count: share.itemCount,
                        created: formatShareExpiry(share.creationTime),
                        expires: formatShareExpiry(share.expiresAt),
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirming(share)}
                    disabled={pending}
                    className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-red-500/10 shrink-0"
                    title={t('DeckShareLinks.revoke')}
                    aria-label={t('DeckShareLinks.revokeNamed', { name: share.name })}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {confirming && (
            <div role="alertdialog" aria-label={t('DeckShareLinks.revoke')} className="rounded-md border border-red-500/40 p-3 space-y-2">
              <p>{t('DeckShareLinks.confirmRevoke', { name: confirming.name })}</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                >
                  {t('DeckSharing.cancel')}
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => {
                    onRevoke(confirming.id);
                    setConfirming(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-sm font-semibold bg-red-500 text-white hover:bg-red-400"
                >
                  {t('DeckShareLinks.revoke')}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {t('DeckShareLinks.close')}
          </button>
        </div>
      </div>
    </DeckDialogFrame>
  );
}
