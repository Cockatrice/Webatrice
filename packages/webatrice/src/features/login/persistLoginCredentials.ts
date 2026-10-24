import type { KnownHostsHook } from '@app/feature-widgets/known-hosts';
import type { LoginFormValues } from './forms/LoginForm/loginFormSchema';

export function persistLoginCredentials(
  hashedPassword: string | undefined,
  { selectedHost, remember, userName }: Pick<LoginFormValues, 'selectedHost' | 'remember' | 'userName'>,
  update: KnownHostsHook['update'],
): ReturnType<KnownHostsHook['update']> | undefined {
  if (selectedHost.id == null) {
    return;
  }
  // @critical empty-salt servers advertise hash support but return no hash — only persist when one arrived
  const persistCredentials = remember && Boolean(hashedPassword);
  return update(selectedHost.id, {
    remember: persistCredentials,
    userName: persistCredentials ? userName : null,
    hashedPassword: persistCredentials ? hashedPassword : null,
  });
}
