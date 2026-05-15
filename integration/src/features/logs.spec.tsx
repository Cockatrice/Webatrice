import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { Logs } from '@app/features/logs';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Logs (integration)', () => {
  it('renders the moderator log search form and the results tabs', () => {
    const { container } = renderFeatureScreen(<Logs />);

    expect(container.querySelector('.moderator-logs')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /LogSearchForm\.button\.search/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Logs\.tab\.rooms/ }),
    ).toBeInTheDocument();
  });
});
