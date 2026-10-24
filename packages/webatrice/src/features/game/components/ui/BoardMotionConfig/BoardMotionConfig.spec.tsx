import { render, screen } from '@testing-library/react';
import { useReducedMotionConfig } from 'motion/react';

import { useBoardAnimations } from '@app/hooks';
import { BoardMotionConfig } from './BoardMotionConfig';

vi.mock('@app/hooks', () => ({ useBoardAnimations: vi.fn() }));

function ReducedMotion() {
  return <span>{String(useReducedMotionConfig())}</span>;
}

describe('BoardMotionConfig', () => {
  it('stops framer-motion animations when the board animation policy is off', () => {
    vi.mocked(useBoardAnimations).mockReturnValue(false);
    render(<BoardMotionConfig><ReducedMotion /></BoardMotionConfig>);
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('plays them when the policy is on, whatever the system setting', () => {
    vi.mocked(useBoardAnimations).mockReturnValue(true);
    render(<BoardMotionConfig><ReducedMotion /></BoardMotionConfig>);
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});
