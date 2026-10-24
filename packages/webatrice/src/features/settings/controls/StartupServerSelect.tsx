import { useTranslation } from 'react-i18next';

import { useKnownHosts } from '@app/feature-widgets/known-hosts';
import { LoadingState, usePreference, useSettings } from '@app/hooks';
import { getHostKey } from '@app/utils';

import type { CustomControlProps } from '../registry';
import { SelectBox } from './fields';

export default function StartupServerSelect({ id, labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const knownHosts = useKnownHosts();
  const stored = usePreference('startupServer');
  const hosts = knownHosts.status === LoadingState.READY ? knownHosts.value?.hosts ?? [] : [];
  const options = [...new Map(hosts.map((host) => [getHostKey(host), host.name])).entries()]
    .map(([value, label]) => ({ value, label }));
  const missing = stored !== '' && !options.some((option) => option.value === stored);

  return (
    <SelectBox
      id={id}
      value={stored}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      disabled={disabled}
      onChange={(e) => void settings.update({ startupServer: e.target.value })}
    >
      <option value="">{t('SettingsGeneral.startupServer.any')}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
      {missing && <option value={stored}>{stored}</option>}
    </SelectBox>
  );
}
