import { memo, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { ServerInfo_Ban, ServerInfo_User, ServerInfo_Warning } from '@cockatrice/sockatrice/generated';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

/**
 * Modals that back the player-list context menu (see
 * `PlayerListContextMenu.tsx`). Each mirrors a Qt dialog in
 * `Cockatrice/cockatrice/src/interface/widgets/server/user/user_context_menu.cpp`
 * (line ranges cited on each modal). Written in Tailwind because the
 * project standard is to replace MUI rather than override it.
 *
 * All modals here are ESC-cancelable and click-outside-cancelable via
 * the shared `ModalShell`. State is driven from the parent (open flag,
 * fetched payload) — they intentionally hold minimal local state so
 * open/close cycles reset cleanly without stale form data.
 */

// ---------------------------------------------------------------------
// Shared modal shell (portal + backdrop + ESC handler).
// ---------------------------------------------------------------------

const MODAL_INPUT_CLASS =
  'w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm '
  + 'text-text-primary focus:outline-none focus:border-accent focus:ring-1 '
  + 'focus:ring-accent disabled:opacity-50';

const MODAL_BUTTON_PRIMARY =
  'px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white '
  + 'hover:bg-accent-hover shadow-glow transition-colors '
  + 'disabled:opacity-50 disabled:cursor-not-allowed';

const MODAL_BUTTON_SECONDARY =
  'px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary '
  + 'hover:text-text-primary hover:bg-bg-elevated transition-colors';

const MODAL_BUTTON_DANGER =
  'px-3 py-1.5 rounded-md text-sm font-semibold bg-red-600 text-white '
  + 'hover:bg-red-500 transition-colors '
  + 'disabled:opacity-50 disabled:cursor-not-allowed';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onCancel: () => void;
  ariaLabel?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

function ModalShell({
  title,
  subtitle,
  onCancel,
  ariaLabel,
  children,
  maxWidthClass = 'max-w-md',
}: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        className={
          'relative w-full rounded-lg bg-bg-surface border border-border-subtle '
          + 'shadow-glow overflow-hidden ' + maxWidthClass
        }
      >
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">{title}</h2>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function InPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

// ---------------------------------------------------------------------
// User details — mirrors Cockatrice's `UserInfoBox` (user_info_box.cpp).
// Read-only view of the target's ServerInfo_User. Level flags rendered
// as chips; avatar preferred from the profile URL when present (fancy
// carries profile metadata alongside the wire's ServerInfo_User; both
// paths render the same avatar column).
// ---------------------------------------------------------------------

function levelFlagLabels(userLevel: number): string[] {
  const labels: string[] = [];
  if ((userLevel & ServerInfo_User_UserLevelFlag.IsAdmin) === ServerInfo_User_UserLevelFlag.IsAdmin) {
    labels.push('Admin');
  }
  if ((userLevel & ServerInfo_User_UserLevelFlag.IsModerator) === ServerInfo_User_UserLevelFlag.IsModerator) {
    labels.push('Moderator');
  }
  if ((userLevel & ServerInfo_User_UserLevelFlag.IsJudge) === ServerInfo_User_UserLevelFlag.IsJudge) {
    labels.push('Judge');
  }
  if ((userLevel & ServerInfo_User_UserLevelFlag.IsRegistered) === ServerInfo_User_UserLevelFlag.IsRegistered) {
    labels.push('Registered');
  }
  if (labels.length === 0) {
    labels.push('Unregistered');
  }
  return labels;
}

function accountAgeString(seconds: bigint): string {
  if (seconds <= 0n) {
    return '—';
  }
  const days = Number(seconds / 86_400n);
  if (days < 1) {
    return 'less than a day';
  }
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'}`;
}

export const UserDetailsModal = memo(function UserDetailsModal({
  user,
  onClose,
}: {
  user: ServerInfo_User;
  onClose: () => void;
}) {
  const flags = levelFlagLabels(user.userLevel);
  return (
    <InPortal>
      <ModalShell
        title={user.name || '(unknown user)'}
        subtitle={user.privlevel ? `Privilege level: ${user.privlevel}` : undefined}
        ariaLabel={`User details for ${user.name}`}
        onCancel={onClose}
      >
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-[80px,1fr] gap-3 items-start">
            <div
              className={
                'h-20 w-20 rounded-md bg-gradient-to-br from-accent-secondary '
                + 'to-accent flex items-center justify-center text-white text-2xl '
                + 'font-modern font-bold shrink-0'
              }
              aria-hidden
            >
              {(user.name || '?').slice(0, 1).toUpperCase()}
            </div>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm min-w-0">
              {user.realName && (
                <>
                  <dt className="text-text-muted">Real name</dt>
                  <dd className="text-text-primary truncate">{user.realName}</dd>
                </>
              )}
              {user.country && (
                <>
                  <dt className="text-text-muted">Country</dt>
                  <dd className="text-text-primary uppercase">{user.country}</dd>
                </>
              )}
              <dt className="text-text-muted">Account age</dt>
              <dd className="text-text-primary">{accountAgeString(user.accountageSecs)}</dd>
            </dl>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {flags.map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 rounded-full text-[11px] bg-bg-elevated border border-border-subtle text-text-primary"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={MODAL_BUTTON_PRIMARY}>
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    </InPortal>
  );
});

// ---------------------------------------------------------------------
// Warn user — mirrors DlgWarnUser (dlg_warn_user.cpp). Reason is
// required (Cockatrice validates non-empty). `removeMessagesInterval`
// is offered as a minute-count so a mod can strip recent chat by the
// target in the same wire (Command_WarnUser.remove_messages).
// ---------------------------------------------------------------------

export const WarnUserModal = memo(function WarnUserModal({
  userName,
  onCancel,
  onConfirm,
}: {
  userName: string;
  onCancel: () => void;
  onConfirm: (args: { reason: string; removeMessagesMinutes: number }) => void;
}) {
  const [reason, setReason] = useState('');
  const [remove, setRemove] = useState('0');
  const removeMinutes = Number(remove);
  const removeValid = Number.isFinite(removeMinutes) && removeMinutes >= 0;
  const valid = reason.trim().length > 0 && removeValid;
  return (
    <InPortal>
      <ModalShell
        title="Warn user"
        subtitle={userName}
        ariaLabel={`Warn ${userName}`}
        onCancel={onCancel}
      >
        <form
          className="px-4 py-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) {
              return;
            }
            onConfirm({ reason: reason.trim(), removeMessagesMinutes: removeMinutes });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Reason</span>
            <textarea
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={MODAL_INPUT_CLASS + ' resize-y min-h-[3rem]'}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Remove chat messages from the last (minutes, 0 = keep all)
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={remove}
              onChange={(e) => setRemove(e.target.value)}
              className={MODAL_INPUT_CLASS}
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={MODAL_BUTTON_SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={!valid} className={MODAL_BUTTON_DANGER}>
              Warn
            </button>
          </div>
        </form>
      </ModalShell>
    </InPortal>
  );
});

// ---------------------------------------------------------------------
// Ban from server — mirrors DlgBanUser (dlg_ban_user.cpp). Distinct
// name / address / clientid identifiers (any subset accepted), minutes
// = 0 means permanent, and both an internal reason (log-only) and a
// visible reason (shown to the banned user).
// ---------------------------------------------------------------------

export const BanFromServerModal = memo(function BanFromServerModal({
  userName,
  onCancel,
  onConfirm,
}: {
  userName: string;
  onCancel: () => void;
  onConfirm: (args: {
    minutes: number;
    banByName: boolean;
    banByIp: boolean;
    banByClientId: boolean;
    reason: string;
    visibleReason: string;
    removeMessagesMinutes: number;
  }) => void;
}) {
  const [minutes, setMinutes] = useState('0');
  const [byName, setByName] = useState(true);
  const [byIp, setByIp] = useState(false);
  const [byClientId, setByClientId] = useState(false);
  const [reason, setReason] = useState('');
  const [visibleReason, setVisibleReason] = useState('');
  const [remove, setRemove] = useState('0');
  const minutesNum = Number(minutes);
  const removeNum = Number(remove);
  const valid =
    Number.isFinite(minutesNum) && minutesNum >= 0
    && Number.isFinite(removeNum) && removeNum >= 0
    && (byName || byIp || byClientId);
  return (
    <InPortal>
      <ModalShell
        title="Ban from server"
        subtitle={userName}
        ariaLabel={`Ban ${userName}`}
        onCancel={onCancel}
        maxWidthClass="max-w-lg"
      >
        <form
          className="px-4 py-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) {
              return;
            }
            onConfirm({
              minutes: minutesNum,
              banByName: byName,
              banByIp: byIp,
              banByClientId: byClientId,
              reason: reason.trim(),
              visibleReason: visibleReason.trim(),
              removeMessagesMinutes: removeNum,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-text-secondary">
                Duration (minutes, 0 = permanent)
              </span>
              <input
                autoFocus
                type="number"
                min={0}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className={MODAL_INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-text-secondary">
                Remove chat messages from the last (minutes)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={remove}
                onChange={(e) => setRemove(e.target.value)}
                className={MODAL_INPUT_CLASS}
              />
            </label>
          </div>
          <fieldset className="flex flex-col gap-1 pt-1">
            <legend className="text-xs font-medium text-text-secondary pb-1">
              Ban by (at least one required)
            </legend>
            <label className="flex items-center gap-2 text-sm text-text-primary select-none">
              <input
                type="checkbox"
                checked={byName}
                onChange={(e) => setByName(e.target.checked)}
                className="accent-accent"
              />
              User name
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary select-none">
              <input
                type="checkbox"
                checked={byIp}
                onChange={(e) => setByIp(e.target.checked)}
                className="accent-accent"
              />
              IP address
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary select-none">
              <input
                type="checkbox"
                checked={byClientId}
                onChange={(e) => setByClientId(e.target.checked)}
                className="accent-accent"
              />
              Client ID
            </label>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Internal reason (log-only)
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={MODAL_INPUT_CLASS + ' resize-y min-h-[2.5rem]'}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Public reason (shown to the banned user)
            </span>
            <textarea
              rows={2}
              value={visibleReason}
              onChange={(e) => setVisibleReason(e.target.value)}
              className={MODAL_INPUT_CLASS + ' resize-y min-h-[2.5rem]'}
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={MODAL_BUTTON_SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={!valid} className={MODAL_BUTTON_DANGER}>
              Ban
            </button>
          </div>
        </form>
      </ModalShell>
    </InPortal>
  );
});

// ---------------------------------------------------------------------
// Admin notes — mirrors DlgAdminNotes (dlg_admin_notes.cpp). Modal is
// mounted after Command_GetAdminNotes lands; parent passes the current
// notes string and receives an updated one on Save. Empty string is a
// valid "clear notes" value (Cockatrice treats it that way too).
// ---------------------------------------------------------------------

export const AdminNotesModal = memo(function AdminNotesModal({
  userName,
  initialNotes,
  onCancel,
  onSave,
}: {
  userName: string;
  initialNotes: string;
  onCancel: () => void;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  return (
    <InPortal>
      <ModalShell
        title="Admin notes"
        subtitle={userName}
        ariaLabel={`Admin notes for ${userName}`}
        onCancel={onCancel}
        maxWidthClass="max-w-lg"
      >
        <form
          className="px-4 py-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(notes);
          }}
        >
          <textarea
            autoFocus
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={MODAL_INPUT_CLASS + ' resize-y min-h-[10rem] font-mono'}
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={MODAL_BUTTON_SECONDARY}>
              Cancel
            </button>
            <button type="submit" className={MODAL_BUTTON_PRIMARY}>
              Save
            </button>
          </div>
        </form>
      </ModalShell>
    </InPortal>
  );
});

// ---------------------------------------------------------------------
// History viewers — mirror the QTableWidget popups in
// user_context_menu.cpp:565-578. Both wait for the corresponding
// response to land before rendering rows; while pending the parent
// shows a spinner-y "Loading…" state via `entries === undefined`.
// ---------------------------------------------------------------------

function formatTimestamp(ts: string | undefined): string {
  if (!ts) {
    return '—';
  }
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    return ts;
  }
  return d.toLocaleString();
}

export const BanHistoryModal = memo(function BanHistoryModal({
  userName,
  entries,
  onClose,
}: {
  userName: string;
  entries: ServerInfo_Ban[] | undefined;
  onClose: () => void;
}) {
  return (
    <InPortal>
      <ModalShell
        title="Ban history"
        subtitle={userName}
        ariaLabel={`Ban history for ${userName}`}
        onCancel={onClose}
        maxWidthClass="max-w-2xl"
      >
        <div className="px-4 py-3 flex flex-col gap-3">
          {entries === undefined && (
            <div className="text-sm text-text-muted italic py-4 text-center">
              Loading ban history…
            </div>
          )}
          {entries !== undefined && entries.length === 0 && (
            <div className="text-sm text-text-muted italic py-4 text-center">
              No bans on record.
            </div>
          )}
          {entries !== undefined && entries.length > 0 && (
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto scrollable border border-border-subtle rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-bg-elevated sticky top-0">
                  <tr className="text-left text-text-secondary">
                    <th className="px-2 py-1 font-medium">Admin</th>
                    <th className="px-2 py-1 font-medium">Time</th>
                    <th className="px-2 py-1 font-medium tabular-nums">Minutes</th>
                    <th className="px-2 py-1 font-medium">Reason</th>
                    <th className="px-2 py-1 font-medium">Visible reason</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((b, i) => (
                    <tr key={i} className="border-t border-border-subtle align-top">
                      <td className="px-2 py-1 text-text-primary">{b.adminName || '—'}</td>
                      <td className="px-2 py-1 text-text-primary whitespace-nowrap">
                        {formatTimestamp(b.banTime)}
                      </td>
                      <td className="px-2 py-1 text-text-primary tabular-nums">{b.banLength}</td>
                      <td className="px-2 py-1 text-text-primary">{b.banReason || '—'}</td>
                      <td className="px-2 py-1 text-text-primary">{b.visibleReason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={MODAL_BUTTON_PRIMARY}>
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    </InPortal>
  );
});

export const WarnHistoryModal = memo(function WarnHistoryModal({
  userName,
  entries,
  onClose,
}: {
  userName: string;
  entries: ServerInfo_Warning[] | undefined;
  onClose: () => void;
}) {
  return (
    <InPortal>
      <ModalShell
        title="Warning history"
        subtitle={userName}
        ariaLabel={`Warning history for ${userName}`}
        onCancel={onClose}
        maxWidthClass="max-w-2xl"
      >
        <div className="px-4 py-3 flex flex-col gap-3">
          {entries === undefined && (
            <div className="text-sm text-text-muted italic py-4 text-center">
              Loading warning history…
            </div>
          )}
          {entries !== undefined && entries.length === 0 && (
            <div className="text-sm text-text-muted italic py-4 text-center">
              No warnings on record.
            </div>
          )}
          {entries !== undefined && entries.length > 0 && (
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto scrollable border border-border-subtle rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-bg-elevated sticky top-0">
                  <tr className="text-left text-text-secondary">
                    <th className="px-2 py-1 font-medium">Admin</th>
                    <th className="px-2 py-1 font-medium">Time</th>
                    <th className="px-2 py-1 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((w, i) => (
                    <tr key={i} className="border-t border-border-subtle align-top">
                      <td className="px-2 py-1 text-text-primary">{w.adminName || '—'}</td>
                      <td className="px-2 py-1 text-text-primary whitespace-nowrap">
                        {formatTimestamp(w.timeOf)}
                      </td>
                      <td className="px-2 py-1 text-text-primary">{w.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={MODAL_BUTTON_PRIMARY}>
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    </InPortal>
  );
});
