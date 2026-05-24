import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { Settings } from '@app/features/settings';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

// ShortcutsTab needs a ShortcutProvider context that AppShell wires in
// production. Stubbing it scopes this spec to Settings' own behaviour
// (the tabs + AuthGuard) — feature-widgets/shortcuts has its own coverage.
vi.mock('@app/feature-widgets/shortcuts', () => ({
  ShortcutsTab: () => <div data-testid="shortcuts-tab" />,
}));

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Settings (integration)', () => {
  it('renders the shortcuts tab when the user is logged in', () => {
    renderFeatureScreen(<Settings />);

    expect(
      screen.getByRole('tab', { name: /Settings\.tab\.shortcuts/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('shortcuts-tab')).toBeInTheDocument();
  });
});
