import { screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';
import Unsupported from './Unsupported';

describe('Unsupported', () => {
  it('renders the unsupported-browser message', () => {
    renderWithProviders(<Unsupported />, { preloadedState: disconnectedState });

    expect(screen.getByText('Unsupported.title')).toBeInTheDocument();
    expect(screen.getByText('Unsupported.subtitle1')).toBeInTheDocument();
    expect(screen.getByText('Unsupported.subtitle2')).toBeInTheDocument();
  });
});
