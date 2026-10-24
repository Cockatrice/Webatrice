import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

import { useBoardAnimations } from '@app/hooks';

export function BoardMotionConfig({ children }: { children: ReactNode }) {
  const boardAnimations = useBoardAnimations();
  return <MotionConfig reducedMotion={boardAnimations ? 'never' : 'always'}>{children}</MotionConfig>;
}
