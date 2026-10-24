import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid3x3, LogOut, PanelTop } from 'lucide-react';

import { server, ServerCapability } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import {
  Avatar, Menu, MenuCheckboxItem, MenuGroup, MenuItem, MenuSeparator, type MenuAnchor,
} from '@app/components';
import type { RouteEnum } from '@app/types';

import type { StaffToolState } from '../staff/staffTools';
import {
  ACCOUNT_ROLE_KEYS, accountRole, STAFF_MENU_LABEL_KEYS, visibleUserMenuEntries, type CapabilityCheck, type UserMenuDialog,
  type UserMenuEntry, type UserMenuSection,
} from './userMenuEntries';

export interface UserMenuProps {
  userName: string | null;
  userLevel: number;
  avatarUrl?: string | null;
  staffTools?: readonly StaffToolState[];
  serverName?: string | null;
  snapGridVisible: boolean;
  onToggleSnapGrid: () => void;
  phaseTrackPinned: boolean;
  onTogglePhaseTrackPinned: () => void;
  onNavigate: (route: RouteEnum) => void;
  onOpenDialog: (dialog: UserMenuDialog) => void;
  onSignOut: () => void;
}

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

function GroupHeading({ children }: { children: string }) {
  return (
    <p aria-hidden className="px-3 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">
      {children}
    </p>
  );
}

export default function UserMenu({
  userName,
  userLevel,
  avatarUrl,
  staffTools = [],
  serverName,
  snapGridVisible,
  onToggleSnapGrid,
  phaseTrackPinned,
  onTogglePhaseTrackPinned,
  onNavigate,
  onOpenDialog,
  onSignOut,
}: UserMenuProps) {
  const { t } = useTranslation();
  const reports = useAppSelector((state) => server.Selectors.supports(state, ServerCapability.REPORTS));
  const supports: CapabilityCheck = (capability) => capability === ServerCapability.REPORTS && reports;
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setAnchor(null), []);

  const toggle = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setAnchor((open) => (open || !rect
      ? null
      : { rect: { left: rect.left, top: rect.top, right: rect.right + 6, bottom: rect.bottom }, placement: 'right' }));
  };

  const displayName = userName ?? t('TopBar.user.signedIn');
  const role = accountRole(userLevel);
  const identityId = useId();
  const entries = visibleUserMenuEntries(userLevel, supports);
  const section = (key: UserMenuSection) => entries.filter((entry) => entry.section === key);
  const [account, tools] = (['account', 'tools'] as const).map(section);

  const renderEntry = (entry: UserMenuEntry) => (
    <MenuItem
      key={entry.route ?? entry.dialog}
      icon={<entry.icon size={15} aria-hidden className="shrink-0 text-text-muted" />}
      onSelect={() => {
        close();
        if (entry.route) {
          onNavigate(entry.route);
        } else {
          onOpenDialog(entry.dialog);
        }
      }}
    >
      {t(entry.label)}
    </MenuItem>
  );

  const renderStaffTool = ({ tool, available }: StaffToolState) => (
    <MenuItem
      key={tool.id}
      icon={<tool.icon size={15} aria-hidden className="shrink-0 text-text-muted" />}
      disabled={!available}
      disabledReason={t('Staff.needsServer')}
      onSelect={() => {
        close();
        onNavigate(tool.route);
      }}
    >
      {t(STAFF_MENU_LABEL_KEYS[tool.id])}
    </MenuItem>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !anchor) {
            e.preventDefault();
            toggle();
          }
        }}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
        className={[
          'flex w-16 flex-col items-center gap-1 rounded-ui py-1.5 text-[10.5px] font-medium hover:bg-bg-elevated',
          focusRing,
          anchor ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary',
        ].join(' ')}
      >
        <Avatar name={displayName} size={30} ring={anchor != null} src={avatarUrl ?? undefined} />
        <span className="max-w-[60px] truncate">{displayName}</span>
      </button>

      {anchor && (
        <Menu
          anchor={anchor}
          label={displayName}
          describedBy={identityId}
          onClose={close}
          triggerRef={triggerRef}
          className="w-[304px] !rounded-ui-lg !border-border-strong px-1.5 !py-1.5 !shadow-pop"
        >
          <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1">
            <Avatar name={displayName} size={32} src={avatarUrl ?? undefined} />
            <div className="min-w-0">
              <p aria-hidden className="truncate text-[13.5px] font-semibold text-text-primary">{displayName}</p>
              <p id={identityId} className="truncate text-[11.5px] text-text-muted">
                {serverName
                  ? t('UserMenu.roleOnServer', { role: t(ACCOUNT_ROLE_KEYS[role]), server: serverName })
                  : t(ACCOUNT_ROLE_KEYS[role])}
              </p>
            </div>
          </div>
          <MenuSeparator />
          {account.map(renderEntry)}
          <MenuSeparator />
          <MenuGroup label={t('UserMenu.onTheBoard')}>
            <GroupHeading>{t('UserMenu.onTheBoard')}</GroupHeading>
            <MenuCheckboxItem
              checked={snapGridVisible}
              onChange={onToggleSnapGrid}
              icon={<Grid3x3 size={15} aria-hidden className="shrink-0 text-text-muted" />}
            >
              {t('TopBar.game.snapGrid')}
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={!phaseTrackPinned}
              onChange={onTogglePhaseTrackPinned}
              icon={<PanelTop size={15} aria-hidden className="shrink-0 text-text-muted" />}
              title={phaseTrackPinned ? t('TopBar.game.phaseTrackCollapse') : t('TopBar.game.phaseTrackPin')}
            >
              {t('TopBar.game.phaseTrackToggle')}
            </MenuCheckboxItem>
          </MenuGroup>
          <MenuSeparator />
          {tools.map(renderEntry)}
          {staffTools.length > 0 && (
            <MenuGroup label={t('UserMenu.staff')}>
              <div className="my-1 rounded-ui-sm border border-dashed border-border-strong px-1 pb-1">
                <GroupHeading>{t('UserMenu.staff')}</GroupHeading>
                <div className="grid grid-cols-2">{staffTools.map(renderStaffTool)}</div>
              </div>
            </MenuGroup>
          )}
          <MenuSeparator />
          <MenuItem
            icon={<LogOut size={15} aria-hidden className="shrink-0 text-text-muted" />}
            onSelect={() => {
              close();
              onSignOut();
            }}
          >
            {t('TopBar.user.signOut')}
          </MenuItem>
        </Menu>
      )}
    </>
  );
}
