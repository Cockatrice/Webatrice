import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { useOpenUserInvestigation, userInvestigationPath } from './useOpenUserInvestigation';

describe('userInvestigationPath', () => {
  it('names the user in the Moderation route query, encoded', () => {
    expect(userInvestigationPath('alice')).toBe('/moderation?user=alice');
    expect(userInvestigationPath('a b&c')).toBe('/moderation?user=a+b%26c');
  });
});

describe('useOpenUserInvestigation', () => {
  it('navigates to the Moderation page on that user', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/room/1']}>{children}</MemoryRouter>;
    const { result } = renderHook(() => ({ open: useOpenUserInvestigation(), location: useLocation() }), { wrapper });

    act(() => result.current.open('mallory'));

    expect(result.current.location.pathname).toBe('/moderation');
    expect(new URLSearchParams(result.current.location.search).get('user')).toBe('mallory');
  });
});
