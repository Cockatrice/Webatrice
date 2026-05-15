import { vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders, createMockWebClient, connectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import Logs from './Logs';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

describe('Logs', () => {
  it('renders the search form and the results tabs', () => {
    const { container } = renderWithProviders(<Logs />, { preloadedState: connectedState });

    expect(container.querySelector('.moderator-logs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LogSearchForm\.button\.search/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Logs\.tab\.rooms/ })).toBeInTheDocument();
  });
});
