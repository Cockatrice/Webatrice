import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { Account } from '@app/features/account';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Account (integration)', () => {
  it('renders the buddy list and ignored users panels', () => {
    renderFeatureScreen(<Account />);

    expect(screen.getByText(/Buddies Online:/)).toBeInTheDocument();
    expect(screen.getByText(/Ignored Users Online:/)).toBeInTheDocument();
  });

  it('shows the Disconnect button and clicking it does not throw', () => {
    renderFeatureScreen(<Account />);

    const disconnect = screen.getByRole('button', { name: /Common\.disconnect/ });
    expect(disconnect).toBeInTheDocument();
    expect(() => fireEvent.click(disconnect)).not.toThrow();
  });
});
