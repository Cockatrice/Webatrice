import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

import { Settings } from '@app/features/settings';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Settings (integration)', () => {
  it('shows every settings section on one page when the user is logged in, and links to Shortcuts', () => {
    renderFeatureScreen(<Settings />);

    const nav = screen.getByRole('navigation', { name: /Settings\.jumpTo/ });
    expect(within(nav).getByRole('button', { name: /Settings\.section\.general/ })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('region', { name: /^Settings\.section\.storage$/ })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('button', { name: /Settings\.section\.shortcuts/ }));

    expect(screen.getByRole('button', { name: /Settings\.shortcuts\.open/ })).toBeInTheDocument();
  });
});
