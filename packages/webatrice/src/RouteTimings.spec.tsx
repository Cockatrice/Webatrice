import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { StrictMode } from 'react';

import { markLoadTiming } from './utils/loadTimings';
import RouteTimings from './RouteTimings';
import { RouteEnum } from './types';

vi.mock('./utils/loadTimings', () => ({ markLoadTiming: vi.fn() }));

function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/player/private-name?secret=private')}>Next</button>;
}

it('records the committed route on mount and navigation using only the route template', () => {
  render(<StrictMode><MemoryRouter initialEntries={['/server']}><Navigation /><RouteTimings /></MemoryRouter></StrictMode>);
  expect(markLoadTiming).toHaveBeenCalledWith('app-render');
  expect(markLoadTiming).toHaveBeenCalledWith('route-ready', RouteEnum.SERVER, true);
  fireEvent.click(screen.getByRole('button'));
  expect(markLoadTiming).toHaveBeenLastCalledWith('route-ready', RouteEnum.PLAYER, true);
});
