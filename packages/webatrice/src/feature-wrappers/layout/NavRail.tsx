import { generatePath, Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { IconButton } from '@app/components';
import { Images } from '@app/images';
import { DebugLogDialog } from '@app/dialogs';
import { RouteEnum } from '@app/types';
import { CardImportDialog } from '@app/feature-widgets/card-import';

import LatencyStatus from './LatencyStatus';
import UnreadBadge from './UnreadBadge';
import UserMenu from './UserMenu';
import { useNavRailController } from './hooks/useNavRailController';
import { useNavRailHidden } from './hooks/useNavRailHidden';
import { PLACE_LABEL_KEYS } from './navPlaces';
import { RAIL_TOGGLE_ID } from './railToggle';
import { UserMenuDialog } from './userMenuEntries';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export default function NavRail() {
  const { t } = useTranslation();
  const [hidden, setHidden] = useNavRailHidden();
  const { places, current, badges, account, openDialog, closeDialog } = useNavRailController();

  return (
    <div
      className={[
        'shrink-0 border-r border-border-subtle bg-bg-surface',
        hidden ? 'flex w-10 flex-col items-center pt-2' : 'grid w-[76px] grid-rows-[1fr_auto_1fr] justify-items-center pb-2 pt-2.5',
      ].join(' ')}
    >
      <div className="flex flex-col items-center gap-2 self-start">
        {!hidden && (
          <NavLink end to={generatePath(RouteEnum.SERVER)} aria-label={t('NavRail.home')} className={`rounded-ui ${focusRing}`}>
            <img src={Images.Logo} alt="" className="h-[34px] w-[34px] rounded-ui-sm" />
          </NavLink>
        )}
        <IconButton
          id={RAIL_TOGGLE_ID}
          size="sm"
          label={hidden ? t('NavRail.toggle.show') : t('NavRail.toggle.hide')}
          onClick={() => setHidden(!hidden)}
        >
          {hidden ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
        </IconButton>
      </div>
      {!hidden && (
        <nav aria-label={t('NavRail.label')} className="py-3">
          <ul className="flex flex-col items-center gap-1">
            {places.map(({ key, icon: Icon, to }) => {
              const active = current === key;
              return (
                <li key={key}>
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'relative flex h-[58px] w-16 flex-col items-center justify-center gap-1 rounded-ui text-[11px] font-semibold',
                      focusRing,
                      active
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                    ].join(' ')}
                  >
                    {active && <span aria-hidden className="absolute -left-1.5 top-3 h-8 w-[3px] rounded-full bg-accent" />}
                    <Icon size={20} aria-hidden />
                    {t(PLACE_LABEL_KEYS[key])}
                    <UnreadBadge count={badges[key] ?? 0} className="absolute right-2 top-1.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      {!hidden && (
        <div className="flex flex-col items-center gap-2 self-end">
          <LatencyStatus />
          <UserMenu {...account} />
        </div>
      )}
      <CardImportDialog
        isOpen={openDialog === UserMenuDialog.CardImport}
        handleClose={closeDialog}
      />
      <DebugLogDialog isOpen={openDialog === UserMenuDialog.DebugLog} onClose={closeDialog} />
    </div>
  );
}
