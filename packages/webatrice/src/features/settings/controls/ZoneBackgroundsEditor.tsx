import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crop, X } from 'lucide-react';

import { games } from '@cockatrice/datatrice';
import { Button, IconButton } from '@app/components';
import { usePreference, useSettings } from '@app/hooks';
import type { ZoneBackground, ZoneBackgroundZone } from '@app/types';

import { ArtPreview, CardNameForm } from '../playmats/ArtParts';
import CropEditor from '../playmats/CropEditor';
import type { CustomControlProps } from '../registry';

const ZONES: readonly ZoneBackgroundZone[] = ['hand', 'stack', 'table', 'playerInfo'];
const TILE = { width: 188, height: 58 };

type Panel = { zone: ZoneBackgroundZone; kind: 'set' | 'crop' } | null;

export default function ZoneBackgroundsEditor({ labelId, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const backgrounds = usePreference('zoneBackgrounds') ?? {};
  const [panel, setPanel] = useState<Panel>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const trigger = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) {
      triggers.current.set(key, element);
    } else {
      triggers.current.delete(key);
    }
  };
  const closePanel = (focusKey: string) => {
    pendingFocus.current = focusKey;
    setPanel(null);
  };

  useEffect(() => {
    const key = pendingFocus.current;
    if (key !== null) {
      pendingFocus.current = null;
      triggers.current.get(key)?.focus();
    }
  });
  const zoneLabel = (zone: ZoneBackgroundZone) => t(`SettingsAppearance.zoneBackgrounds.zone.${zone}`);

  const setZone = (zone: ZoneBackgroundZone, background: ZoneBackground | undefined) => {
    const next = { ...backgrounds };
    if (background) {
      next[zone] = background;
    } else {
      delete next[zone];
    }
    void settings.update({ zoneBackgrounds: next });
  };

  const toggle = (zone: ZoneBackgroundZone, kind: 'set' | 'crop') =>
    setPanel(panel?.zone === zone && panel.kind === kind ? null : { zone, kind });
  const open = panel ? backgrounds[panel.zone] : undefined;
  const panelId = panel ? `zone-background-${panel.zone}-${panel.kind}` : undefined;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-gap" aria-labelledby={labelId}>
        {ZONES.map((zone) => {
          const background = backgrounds[zone];
          const label = zoneLabel(zone);
          const isOpen = (kind: 'set' | 'crop') => panel?.zone === zone && panel.kind === kind;
          return (
            <li key={zone} className="flex flex-col gap-1" style={{ width: TILE.width }} data-zone-background={zone}>
              <ArtPreview playmat={background} {...TILE} empty={t('SettingsAppearance.zoneBackgrounds.none')} />
              <span className="flex items-center gap-1 text-[12px]">
                <span className="font-medium text-text-primary">{label}</span>
                <span className="min-w-0 flex-1 truncate text-text-muted" title={background?.cardName}>
                  {background?.cardName ?? ''}
                </span>
                {background && (
                  <>
                    <IconButton
                      ref={trigger(`${zone}:crop`)}
                      size="sm"
                      className="!h-6 !w-6"
                      label={t('SettingsAppearance.zoneBackgrounds.editLabel', { zone: label })}
                      disabled={disabled}
                      aria-expanded={isOpen('crop')}
                      aria-controls={isOpen('crop') ? panelId : undefined}
                      onClick={() => toggle(zone, 'crop')}
                    >
                      <Crop size={13} aria-hidden />
                    </IconButton>
                    <IconButton
                      size="sm"
                      className="!h-6 !w-6 hover:!text-danger"
                      label={t('SettingsAppearance.zoneBackgrounds.clearLabel', { zone: label })}
                      disabled={disabled}
                      onClick={() => {
                        setZone(zone, undefined);
                        closePanel(`${zone}:set`);
                      }}
                    >
                      <X size={13} aria-hidden />
                    </IconButton>
                  </>
                )}
                <Button
                  ref={trigger(`${zone}:set`)}
                  size="sm"
                  variant="ghost"
                  className="!h-6 !px-1.5"
                  disabled={disabled}
                  aria-label={t('SettingsAppearance.zoneBackgrounds.chooseLabel', { zone: label })}
                  aria-expanded={isOpen('set')}
                  aria-controls={isOpen('set') ? panelId : undefined}
                  onClick={() => toggle(zone, 'set')}
                >
                  {background ? t('SettingsAppearance.zoneBackgrounds.change') : t('SettingsAppearance.zoneBackgrounds.set')}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {panel?.kind === 'set' && (
        <div id={panelId}>
          <CardNameForm
            key={panel.zone}
            label={t('SettingsAppearance.zoneBackgrounds.cardName', { zone: zoneLabel(panel.zone) })}
            submitLabel={t('SettingsAppearance.zoneBackgrounds.set')}
            submitAriaLabel={t('SettingsAppearance.zoneBackgrounds.setLabel', { zone: zoneLabel(panel.zone) })}
            disabled={disabled}
            onSubmit={(cardName) => {
              setZone(panel.zone, { cardName, cardProviderId: '', params: games.DEFAULT_PLAYMAT_PARAMS });
              closePanel(`${panel.zone}:set`);
              return { ok: true };
            }}
            onCancel={() => closePanel(`${panel.zone}:set`)}
          />
        </div>
      )}
      {panel?.kind === 'crop' && open && (
        <div id={panelId} className="flex flex-col gap-2 rounded-ui border border-border-subtle bg-bg-sunken p-3">
          <span className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
            {t('PlaymatSettings.collection.cropOf', { card: open.cardName })}
            <Button size="sm" variant="quiet" className="ml-auto" onClick={() => closePanel(`${panel.zone}:crop`)}>
              {t('PlaymatSettings.collection.done')}
            </Button>
          </span>
          <CropEditor key={panel.zone} playmat={open} onChange={(params) => setZone(panel.zone, { ...open, params })} />
        </div>
      )}
    </div>
  );
}
