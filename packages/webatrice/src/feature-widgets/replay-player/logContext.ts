import type { TFunction } from 'i18next';
import type { LogParamsByKind, LogPlayer, LogSegment } from '@cockatrice/datatrice';
import { ZoneName } from '@cockatrice/sockatrice';
import { phaseLabel } from '@app/utils';
import { translatedLog } from './logTranslation';

export function createLogContext(t: TFunction) {
  const playerName = (player: LogPlayer) => player.name ?? (
    player.id === undefined ? t('GameLog.player.unknown')
      : player.id < 0 ? t('GameLog.player.server') : t('GameLog.player.number', { id: player.id })
  );
  const c = (name: string | undefined | null): LogSegment => name
    ? { text: name, kind: 'card' } : { text: t('GameLog.card.unknown'), kind: 'plain' };
  const zones: Record<string, string> = {
    table: 'battlefield', hand: 'hand', grave: 'graveyard', rfg: 'exile', deck: 'library', sideboard: 'sideboard', stack: 'stack',
  };
  const zoneLabelReveal = (zone: string, owner: boolean) => zones[zone]
    ? t(`GameLog.zone.${zones[zone]}.${owner ? 'own' : 'other'}`) : t('GameLog.zone.custom', { zone });
  const zoneLabelBare = (zone: string) => zones[zone]
    ? t(`GameLog.zone.${zones[zone]}.bare`) : t('GameLog.zone.custom', { zone });
  const counterKeys: Record<string, string> = {
    life: 'life', w: 'white', u: 'blue', b: 'black', r: 'red', g: 'green', x: 'colorless', storm: 'other',
  };
  const displayCounterName = (name: string) => !name ? t('GameLog.counter.unknown')
    : counterKeys[name.toLowerCase()] ? t(`GameLog.counter.${counterKeys[name.toLowerCase()]}`) : name;

  const fromContext = (data: LogParamsByKind['cardMoved'], own: boolean, hasCardName: boolean) => {
    if (data.startZone === ZoneName.DECK) {
      const position = data.position === 0 ? 'top'
        : data.sourceCount > 0 && data.position === data.sourceCount ? 'bottom' : 'any';
      const ownership = own ? 'own' : 'other';
      const owner = playerName(data.sourceOwner);
      if (!hasCardName && position !== 'any') {
        return { nameOverride: t(`GameLog.sourceCard.${position}.${ownership}`, { owner }), from: '' };
      }
      return { from: t(`GameLog.source.library.${position}.${ownership}`, { owner }) };
    }
    const key = zones[data.startZone];
    return { from: key ? t(`GameLog.source.${key}`) : t('GameLog.source.custom', { zone: data.startZone }) };
  };
  return {
    playerName, c, zoneLabelReveal, zoneLabelBare, displayCounterName, fromContext,
    phaseName: (phase: number) => phaseLabel(t, phase, 'log'),
    line: (key: string, values?: Record<string, string | LogSegment>) => translatedLog(t, key, values),
    label: (key: string, values?: Record<string, string | number>) => t(`GameLog.${key}`, values),
  };
}
export type LogContext = ReturnType<typeof createLogContext>;
