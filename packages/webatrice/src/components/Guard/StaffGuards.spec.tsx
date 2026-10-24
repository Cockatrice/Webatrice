import { useEffect, type ReactElement } from 'react';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { ServerCapability } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { renderWithProviders, connectedState, makeUser } from '../../__test-utils__';
import CapabilityGuard from './CapabilityGuard';
import DeveloperGuard from './DeveloperGuard';

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => ({})) };
});

function state(version: string | null, userLevel = 0) {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      info: { message: null, name: 'Servatrice', version },
      user: makeUser({ userLevel }),
    },
  };
}

function renderPage(guard: ReactElement, preloadedState: ReturnType<typeof state>) {
  renderWithProviders(
    <Routes>
      <Route path="/server" element={<div>server-page</div>} />
      <Route path="/staff" element={<>{guard}<div>staff-page</div></>} />
    </Routes>,
    { preloadedState, route: '/staff' },
  );
}

describe('CapabilityGuard', () => {
  it('keeps the page on a server that supports the capability', () => {
    renderPage(<CapabilityGuard capability={ServerCapability.MODERATION_TOOLS} />, state('3.1.0 (2026-01-01)'));
    expect(screen.getByText('staff-page')).toBeInTheDocument();
  });

  it.each([['3.0.0 (2024-01-01)'], [null], ['custom build']])('sends the user away from server version %s', (version) => {
    renderPage(<CapabilityGuard capability={ServerCapability.MODERATION_TOOLS} />, state(version));
    expect(screen.getByText('server-page')).toBeInTheDocument();
  });
});

describe('DeveloperGuard', () => {
  it('keeps the page for a developer', () => {
    renderPage(<DeveloperGuard />, state('3.1.0 ()', ServerInfo_User_UserLevelFlag.IsDeveloper));
    expect(screen.getByText('staff-page')).toBeInTheDocument();
  });

  it('sends a moderator without the developer bit away', () => {
    renderPage(<DeveloperGuard />, state('3.1.0 ()', ServerInfo_User_UserLevelFlag.IsModerator));
    expect(screen.getByText('server-page')).toBeInTheDocument();
  });
});

describe('staff guards wrapping a page', () => {
  const mounted = vi.fn();
  const StaffPage = () => {
    useEffect(mounted, []);
    return <div>staff-page</div>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CapabilityGuard never mounts the page on a server without the capability', () => {
    renderPage(
      <CapabilityGuard capability={ServerCapability.MODERATION_TOOLS}><StaffPage /></CapabilityGuard>,
      state('3.0.0 (2024-01-01)'),
    );
    expect(screen.getByText('server-page')).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });

  it('DeveloperGuard never mounts the page for a non-developer', () => {
    renderPage(<DeveloperGuard><StaffPage /></DeveloperGuard>, state('3.1.0 ()', ServerInfo_User_UserLevelFlag.IsModerator));
    expect(screen.getByText('server-page')).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });

  it('mounts the page when both allow it', () => {
    renderPage(
      <DeveloperGuard>
        <CapabilityGuard capability={ServerCapability.DEVELOPER_ROLE}><StaffPage /></CapabilityGuard>
      </DeveloperGuard>,
      state('3.1.0 ()', ServerInfo_User_UserLevelFlag.IsDeveloper),
    );
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});
