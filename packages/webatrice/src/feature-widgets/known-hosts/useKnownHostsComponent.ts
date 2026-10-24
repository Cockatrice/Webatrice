import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { LoadingState, useReduxEffect, useSettings } from '@app/hooks';

import { useKnownHosts } from './useKnownHosts';
import { useWebClient } from '@cockatrice/datatrice/react';
import { HostDTO, type PublicServer } from '@app/services';
import { server } from '@cockatrice/datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';
import { Host } from '@app/types';
import { getHostPort } from '@app/utils';

import { toSavedHost } from './usePublicServers';
import { autoLoginGate } from '../../services/session/autoLoginGate';

export enum TestConnection {
  TESTING = 'testing',
  FAILED = 'failed',
  SUCCESS = 'success',
}

export interface KnownHostsComponent {
  hosts: HostDTO[];
  selectedHost: HostDTO | undefined;
  testConnectionStatus: TestConnection | null;
  dialogState: { open: boolean; edit: HostDTO | null };
  onPick: (id: number) => Promise<void>;
  onPickPublicServer: (server: PublicServer) => Promise<void>;
  refreshConnection: () => void;
  openAddKnownHostDialog: () => void;
  openEditKnownHostDialog: (host: HostDTO) => void;
  closeKnownHostDialog: () => void;
  handleDialogRemove: (host: HostDTO) => Promise<void>;
  handleDialogSubmit: (args: {
    id?: number;
    name: string;
    host: string;
    port: string;
    desktopPort?: string;
  }) => Promise<void>;
}

export interface UseKnownHostsComponentArgs {
  onChange: (value: HostDTO) => void;
}

type ToastMode = 'created' | 'deleted' | 'edited';

export function useKnownHostsComponent({
  onChange,
}: UseKnownHostsComponentArgs): KnownHostsComponent {
  const webClient = useWebClient();
  const knownHosts = useKnownHosts();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const autoLoginInFlight = useSyncExternalStore(autoLoginGate.subscribe, autoLoginGate.getInFlight);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const settings = useSettings();

  const knownHostToast = useToast({ key: 'known-hosts-action' });

  const [dialogState, setDialogState] = useState<{ open: boolean; edit: HostDTO | null }>({
    open: false,
    edit: null,
  });

  const testConnectionStatus = useAppSelector(server.Selectors.getTestConnectionStatus) as
    | TestConnection
    | null;
  const pendingTestRef = useRef<HostDTO | null>(null);

  const selectedHost =
    knownHosts.status === LoadingState.READY ? knownHosts.value?.selectedHost : undefined;
  const hosts = knownHosts.status === LoadingState.READY ? knownHosts.value?.hosts ?? [] : [];
  const selection = useRef({ selectedHost, onChange });
  selection.current = { selectedHost, onChange };
  const lastProbe = useRef<{ id: number | undefined; host: string; port: string } | null>(null);
  const selectedId = selectedHost?.id;
  const selectedAddress = selectedHost?.host;
  const selectedPort = selectedHost?.port;

  const testConnection = useCallback((host: HostDTO, force = false) => {
    if (autoLoginGate.inFlight) {
      return;
    }
    const key = { id: host.id, host: host.host, port: host.port };
    if (!force && lastProbe.current && lastProbe.current.id === key.id
      && lastProbe.current.host === key.host && lastProbe.current.port === key.port) {
      return;
    }
    lastProbe.current = key;
    pendingTestRef.current = host;
    dispatch(server.Actions.testConnectionStarted());
    webClient.request.authentication.testConnection({ ...getHostPort(host) });
  }, [dispatch, webClient]);

  const refreshConnection = () => {
    if (!selectedHost) {
      return;
    }
    testConnection(selectedHost, true);
  };

  useEffect(() => {
    if (autoLoginInFlight || (autoLoginGate.target && isConnected)) {
      return;
    }
    const host = selection.current.selectedHost;
    if (!host) {
      lastProbe.current = null;
      return;
    }
    if (!isConnected && !autoLoginGate.hasChecked && (settings.status === LoadingState.LOADING
      || (settings.value?.autoConnect && host.remember && host.hashedPassword && host.userName))) {
      return;
    }
    testConnection(host);
  }, [selectedId, selectedAddress, selectedPort, testConnection, autoLoginInFlight, isConnected, settings.status, settings.value]);

  useEffect(() => {
    if (selectedHost) {
      selection.current.onChange(selectedHost);
    }
  }, [selectedHost]);

  useReduxEffect<{ supportsHashedPassword: boolean }>(({ payload: { supportsHashedPassword } }) => {
    const host = pendingTestRef.current;
    if (!host) {
      return;
    }
    pendingTestRef.current = null;

    if (host.id != null && host.supportsHashedPassword !== supportsHashedPassword) {
      void knownHosts.update(host.id, { supportsHashedPassword });
    }
  }, server.Types.TEST_CONNECTION_SUCCESSFUL, []);

  useReduxEffect(() => {
    pendingTestRef.current = null;
  }, server.Types.TEST_CONNECTION_FAILED, []);

  const fireToast = (mode: ToastMode) => {
    knownHostToast.openToast(t('KnownHosts.toast', { mode }));
  };

  const selectAndProbeHost = async (host: HostDTO) => {
    if (host.id == null) {
      return;
    }
    onChange(host);
    testConnection(host, true);
    await knownHosts.select(host.id);
  };

  const onPick = async (id: number) => {
    if (knownHosts.status !== LoadingState.READY) {
      return;
    }
    const host = knownHosts.value?.hosts.find((h) => h.id === id);
    if (!host) {
      return;
    }
    await selectAndProbeHost(host);
  };

  const onPickPublicServer = async (server: PublicServer) => {
    if (knownHosts.status !== LoadingState.READY) {
      return;
    }
    const created = await knownHosts.add(toSavedHost(server));
    await selectAndProbeHost(created);
  };

  const openAddKnownHostDialog = () => {
    setDialogState((s) => ({ ...s, open: true, edit: null }));
  };

  const openEditKnownHostDialog = (host: HostDTO) => {
    setDialogState((s) => ({ ...s, open: true, edit: host }));
  };

  const closeKnownHostDialog = () => {
    setDialogState((s) => ({ ...s, open: false }));
  };

  const handleDialogRemove = async (host: HostDTO) => {
    if (knownHosts.status !== LoadingState.READY || host.id === undefined) {
      return;
    }
    await knownHosts.remove(host.id);
    closeKnownHostDialog();
    fireToast('deleted');
  };

  const handleDialogSubmit = async ({
    id,
    name,
    host,
    port,
    desktopPort,
  }: {
    id?: number;
    name: string;
    host: string;
    port: string;
    desktopPort?: string;
  }) => {
    if (knownHosts.status !== LoadingState.READY) {
      return;
    }

    if (id) {
      await knownHosts.update(id, { name, host, port, desktopPort: desktopPort || undefined });
      fireToast('edited');
    } else {
      const newHost: Host = { name, host, port, desktopPort: desktopPort || undefined, editable: true };
      const created = await knownHosts.add(newHost);
      await selectAndProbeHost(created);
      fireToast('created');
    }

    closeKnownHostDialog();
  };

  return {
    hosts,
    selectedHost,
    testConnectionStatus,
    dialogState,
    onPick,
    onPickPublicServer,
    refreshConnection,
    openAddKnownHostDialog,
    openEditKnownHostDialog,
    closeKnownHostDialog,
    handleDialogRemove,
    handleDialogSubmit,
  };
}
