import { StrictMode } from 'react';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

import NewSetsPrompt from './NewSetsPrompt';

it.each(['hide', 'unmount'])('focuses the prompt when shown and restores its opener on %s', (close) => {
  const onAnswer = vi.fn();
  const view = (codes: string[]) => <StrictMode>
    <button>Import cards</button>
    <NewSetsPrompt codes={codes} onAnswer={onAnswer} />
  </StrictMode>;
  const { rerender } = renderWithProviders(view([]));
  const opener = screen.getByRole('button', { name: 'Import cards' });
  opener.focus();
  rerender(view(['ABC']));
  expect(screen.getByRole('button', { name: 'CardDatabaseOverview.newSets.yes' })).toHaveFocus();
  if (close === 'hide') {
    rerender(view([]));
  } else {
    rerender(<StrictMode><button>Import cards</button></StrictMode>);
  }
  expect(opener).toHaveFocus();
});
