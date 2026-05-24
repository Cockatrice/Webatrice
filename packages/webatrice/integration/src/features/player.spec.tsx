import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { Player } from '@app/features/player';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Player (integration)', () => {
  it('shows the not-found state for an unknown player name', () => {
    renderFeatureScreen(
      <Routes>
        <Route path="/player/:name" element={<Player />} />
      </Routes>,
      '/player/ghost',
    );

    expect(screen.getByText('Player.action.notFound')).toBeInTheDocument();
  });
});
