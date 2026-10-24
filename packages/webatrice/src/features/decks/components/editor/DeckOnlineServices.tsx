import { useTranslation } from 'react-i18next';
import { ExternalLink, Printer, Send } from 'lucide-react';

import { MenuItem, MenuSubmenu } from '@app/components';

import { openInNewTab, printHtml, submitFormInNewTab } from '../../browserHandoff';
import {
  decklistExportUrl,
  deckPrintHtml,
  deckstatsAnalyzeForm,
  tappedOutAnalyzeForm,
  type DecklistSite,
} from '../../deckServices';
import type { HydratedDeck } from '../../types';

export interface DeckOnlineServiceItemsProps {
  deck: HydratedDeck;
}

export function DeckOnlineServiceItems({ deck }: DeckOnlineServiceItemsProps) {
  const { t } = useTranslation();
  const empty = deck.cards.length === 0;
  const emptyReason = empty ? t('DeckTools.empty') : undefined;

  const exportDecklist = (site: DecklistSite) => {
    const url = decklistExportUrl(deck, site);
    if (url) {
      openInNewTab(url);
    }
  };

  return (
    <>
      <MenuItem
        icon={<Printer size={13} />}
        onSelect={() => printHtml(deckPrintHtml(deck, {
          main: t('DeckTools.zone.main'),
          sideboard: t('DeckTools.zone.sideboard'),
        }))}
      >
        {t('DeckTools.print')}
      </MenuItem>
      <MenuSubmenu label={t('DeckTools.sendTo')} icon={<Send size={13} />} className="w-[220px]">
        <MenuItem
          icon={<ExternalLink size={12} />}
          disabled={empty}
          disabledReason={emptyReason}
          onSelect={() => exportDecklist('decklist.org')}
        >
          {t('DeckTools.decklistOrg')}
        </MenuItem>
        <MenuItem
          icon={<ExternalLink size={12} />}
          disabled={empty}
          disabledReason={emptyReason}
          onSelect={() => exportDecklist('decklist.xyz')}
        >
          {t('DeckTools.decklistXyz')}
        </MenuItem>
        <MenuItem
          icon={<ExternalLink size={12} />}
          disabled={empty}
          disabledReason={emptyReason}
          onSelect={() => submitFormInNewTab(deckstatsAnalyzeForm(deck))}
        >
          {t('DeckTools.deckstats')}
        </MenuItem>
        <MenuItem
          icon={<ExternalLink size={12} />}
          disabled={empty}
          disabledReason={emptyReason}
          onSelect={() => submitFormInNewTab(tappedOutAnalyzeForm(deck))}
        >
          {t('DeckTools.tappedout')}
        </MenuItem>
      </MenuSubmenu>
    </>
  );
}
