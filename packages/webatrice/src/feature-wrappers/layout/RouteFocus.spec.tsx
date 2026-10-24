import { StrictMode, useEffect, useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import Layout from './Layout';
import RouteFocus from './RouteFocus';

vi.mock('./TopBar', () => ({ default: () => null }));
vi.mock('./NavRail', () => ({ default: () => null }));

function FirstPage() {
  return <Layout><input aria-label="First input" autoFocus /></Layout>;
}

function SecondPage() {
  return <Layout><h1>Second page</h1></Layout>;
}

function FocusedPage() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return <Layout><input ref={input} aria-label="Focused input" /></Layout>;
}

function Navigation() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate('/second')}>Next page</button>
    <button onClick={() => navigate('/first')}>First page</button>
    <button onClick={() => navigate('/first?filter=all#results')}>Filter</button>
    <button onClick={() => navigate('/game/1')}>Game</button>
    <button onClick={() => navigate('/replay/1')}>Replay</button>
    <button onClick={() => navigate('/focused')}>Focused page</button>
  </>;
}

function BoardPage() {
  return <Layout><div data-game-board tabIndex={0} ref={element => element?.focus()}>Board</div></Layout>;
}

function setup(dialog = false) {
  return render(<StrictMode><MemoryRouter initialEntries={['/first']}>
    <Navigation />
    <Routes>
      <Route path="/first" element={<FirstPage />} />
      <Route path="/second" element={<SecondPage />} />
      <Route path="/game/:id" element={<BoardPage />} />
      <Route path="/replay/:id" element={<BoardPage />} />
      <Route path="/focused" element={<FocusedPage />} />
    </Routes>
    <RouteFocus />
    {dialog && <div role="dialog" aria-label="Open dialog"><input aria-label="Dialog input" /></div>}
  </MemoryRouter></StrictMode>);
}

it('leaves first-load focus alone, including StrictMode effect replay', () => {
  setup();
  expect(screen.getByRole('textbox', { name: 'First input' })).toHaveFocus();
});

it('focuses the new main unless the destination page sets focus', () => {
  setup();
  const firstMain = screen.getByRole('main');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByRole('main')).not.toBe(firstMain);
  expect(screen.getByRole('main')).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'First page' }));
  expect(screen.getByRole('textbox', { name: 'First input' })).toHaveFocus();
});

it('leaves focus alone for search and hash changes', () => {
  setup();
  const input = screen.getByRole('textbox', { name: 'First input' });
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
  expect(input).toHaveFocus();
});

it('preserves focus set by a destination page mount effect', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Focused page' }));
  expect(screen.getByRole('textbox', { name: 'Focused input' })).toHaveFocus();
});

it('preserves focus in an open dialog during a route change', () => {
  setup(true);
  const input = screen.getByRole('textbox', { name: 'Dialog input' });
  input.focus();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(input).toHaveFocus();
});

it.each(['Game', 'Replay'])('leaves the %s board focused', (name) => {
  setup();
  fireEvent.click(screen.getByRole('button', { name }));
  expect(screen.getByText('Board')).toHaveFocus();
});

it('treats a new router as a fresh load', () => {
  setup().unmount();
  setup();
  expect(screen.getByRole('textbox', { name: 'First input' })).toHaveFocus();
});
