import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@app/components';
import { ConfirmDialog } from '@app/dialogs';
import { refreshCardDataPreferences } from '@app/hooks';
import {
  ALL_STORES,
  CARD_DATA_STORES,
  clearCardData,
  clearScryfallCache,
  isPersistentStorageSupported,
  requestPersistentStorage,
  SCRYFALL_CACHE_STORES,
  type Stores,
} from '@app/services';
import { cx, toBcp47 } from '@app/utils';

import type { CustomControlProps } from '../registry';
import { refreshStorageStatus, useStorageStatus, type StorageStatus } from './useStorageStatus';

export function formatBytes(bytes: number, language: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return new Intl.NumberFormat(toBcp47(language) || undefined, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

const total = (status: StorageStatus, stores: readonly Stores[]) =>
  stores.reduce((sum, store) => sum + (status.counts[store] ?? 0), 0);

export function StorageUsageControl({ labelId, describedBy }: CustomControlProps) {
  const { t, i18n } = useTranslation();
  const status = useStorageStatus();
  const { usage } = status;
  const percent = usage && usage.quota > 0 ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;

  return (
    <div
      className="flex flex-col gap-2 text-[13px] text-text-secondary"
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
    >
      {!status.loaded ? (
        <span className="text-text-muted">{t('SettingsStorage.loading')}</span>
      ) : usage ? (
        <>
          <span className="font-medium text-text-primary">
            {t('SettingsStorage.usage.value', {
              used: formatBytes(usage.usage, i18n.language),
              quota: formatBytes(usage.quota, i18n.language),
            })}
          </span>
          <progress
            className={cx(
              'h-2.5 w-full appearance-none overflow-hidden rounded-full bg-bg-elevated',
              '[&::-webkit-progress-bar]:bg-bg-elevated [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent',
            )}
            max={100}
            value={percent}
            aria-labelledby={labelId}
          />
        </>
      ) : (
        <span className="text-text-muted">{t('SettingsStorage.usage.unavailable')}</span>
      )}
      {status.loaded && (
        <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-1 text-[12px]">
          {ALL_STORES.map((store) => (
            <div key={store} className="flex justify-between gap-2">
              <dt className="text-text-muted">{t(`SettingsStorage.table.${store}`)}</dt>
              <dd className="m-0 font-mono tabular-nums">
                {(status.counts[store] ?? 0).toLocaleString(toBcp47(i18n.language) || undefined)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function PersistentStorageControl({ id, labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const { persisted } = useStorageStatus();
  const [refused, setRefused] = useState(false);

  const request = async () => {
    const granted = await requestPersistentStorage();
    setRefused(!granted);
    await refreshStorageStatus();
  };

  const state = persisted ? 'granted' : refused ? 'refused' : 'default';

  return (
    <span className="inline-flex flex-wrap items-center gap-3" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      <span
        className={state === 'refused' ? 'text-[12px] text-danger' : 'text-[12px] text-text-muted'}
        data-permission={state === 'refused' ? 'denied' : state}
      >
        {t(`SettingsStorage.persistent.status.${state}`)}
      </span>
      {!persisted && isPersistentStorageSupported() && (
        <Button id={id} disabled={disabled} onClick={request} icon={<ShieldCheck size={14} aria-hidden />}>
          {t('SettingsStorage.persistent.request')}
        </Button>
      )}
    </span>
  );
}

interface ClearStoresControlProps extends CustomControlProps {
  stores: readonly Stores[];
  clear: () => Promise<void>;
  keyPrefix: string;
  confirm: boolean;
}

function ClearStoresControl({ id, labelId, describedBy, disabled, stores, clear, keyPrefix, confirm }: ClearStoresControlProps) {
  const { t } = useTranslation();
  const status = useStorageStatus();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const count = total(status, stores);

  const run = async () => {
    setConfirming(false);
    setBusy(true);
    setFailed(false);
    try {
      await clear();
    } catch {
      setFailed(true);
    }
    await refreshStorageStatus();
    setBusy(false);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-3" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      <span
        className={failed ? 'text-[12px] text-danger' : 'text-[12px] text-text-muted'}
        data-permission={failed ? 'denied' : undefined}
      >
        {failed ? t('SettingsStorage.clearFailed') : t(`${keyPrefix}.count`, { count })}
      </span>
      <Button
        id={id}
        variant={confirm ? 'danger' : 'secondary'}
        icon={<Trash2 size={14} aria-hidden />}
        disabled={disabled || busy || !status.loaded || count === 0}
        onClick={() => (confirm ? setConfirming(true) : void run())}
      >
        {t(`${keyPrefix}.button`)}
      </Button>
      {confirm && (
        <ConfirmDialog
          isOpen={confirming}
          title={t(`${keyPrefix}.confirm.title`)}
          message={t(`${keyPrefix}.confirm.message`)}
          confirmLabel={t(`${keyPrefix}.button`)}
          cancelLabel={t('SettingsStorage.cancel')}
          destructive
          onConfirm={() => void run()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </span>
  );
}

export function ClearScryfallCacheControl(props: CustomControlProps) {
  return (
    <ClearStoresControl
      {...props}
      stores={SCRYFALL_CACHE_STORES}
      clear={clearScryfallCache}
      keyPrefix="SettingsStorage.scryfallCache"
      confirm={false}
    />
  );
}

async function deleteCardData(): Promise<void> {
  await clearCardData();
  await refreshCardDataPreferences();
}

export function ClearCardDataControl(props: CustomControlProps) {
  return (
    <ClearStoresControl
      {...props}
      stores={CARD_DATA_STORES}
      clear={deleteCardData}
      keyPrefix="SettingsStorage.cardData"
      confirm
    />
  );
}
