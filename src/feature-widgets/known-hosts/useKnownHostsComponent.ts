import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { LoadingState, useKnownHosts, useReduxEffect } from '@app/hooks';
import { useWebClient } from 'datatrice/react';
import { HostDTO } from '@app/services';
import { server } from 'datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';
import { Host } from '@app/types';
import { getHostPort } from '@app/utils';

export enum TestConnection {
  TESTING = 'testing',
  FAILED = 'failed',
  SUCCESS = 'success',
}

export interface KnownHostsComponent {
  // Dexie's mapToClass(HostDTO) means stored records are HostDTO instances
  // (Host extended with `.save()`), not plain Host. Widen the surface so the
  // template can pass these into HostDTO-typed callbacks without a cast.
  hosts: HostDTO[];
  selectedHost: HostDTO | undefined;
  testConnectionStatus: TestConnection | null;
  dialogState: { open: boolean; edit: HostDTO | null };
  onPick: (id: number) => Promise<void>;
  openAddKnownHostDialog: () => void;
  openEditKnownHostDialog: (host: HostDTO) => void;
  closeKnownHostDialog: () => void;
  // KnownHostDialog calls onRemove with the full HostDTO. The runtime branch
  // here only needs the id (Dexie key); guard against missing id since the
  // class field is declared optional.
  handleDialogRemove: (host: HostDTO) => Promise<void>;
  handleDialogSubmit: (args: {
    id?: number;
    name: string;
    host: string;
    port: string;
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

  const [toastMode, setToastMode] = useState<ToastMode>('created');
  const knownHostToast = useToast({
    key: 'known-hosts-action',
    children: t('KnownHosts.toast', { mode: toastMode }),
  });

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

  const testConnection = (host: HostDTO) => {
    pendingTestRef.current = host;
    dispatch(server.Actions.testConnectionStarted());
    webClient.request.authentication.testConnection({ ...getHostPort(host) });
  };

  useEffect(() => {
    if (!selectedHost) {
      return;
    }
    onChange(selectedHost);
    testConnection(selectedHost);
  }, [selectedHost]);

  // Recover from serverSlice.actions.disconnected() wiping status to null mid-flight.
  useEffect(() => {
    if (selectedHost && testConnectionStatus === null) {
      testConnection(selectedHost);
    }
  }, [testConnectionStatus]);

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
    setToastMode(mode);
    knownHostToast.openToast();
  };

  const onPick = async (id: number) => {
    if (knownHosts.status !== LoadingState.READY) {
      return;
    }
    const host = knownHosts.value?.hosts.find((h) => h.id === id);
    if (!host) {
      return;
    }
    onChange(host);
    await knownHosts.select(id);
    testConnection(host);
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
  }: {
    id?: number;
    name: string;
    host: string;
    port: string;
  }) => {
    if (knownHosts.status !== LoadingState.READY) {
      return;
    }

    if (id) {
      await knownHosts.update(id, { name, host, port });
      fireToast('edited');
    } else {
      const newHost: Host = { name, host, port, editable: true };
      await knownHosts.add(newHost);
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
    openAddKnownHostDialog,
    openEditKnownHostDialog,
    closeKnownHostDialog,
    handleDialogRemove,
    handleDialogSubmit,
  };
}
