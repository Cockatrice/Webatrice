import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary, ErrorFallback } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';

export default function GameErrorBoundary({ gameId, children }: { gameId: number | undefined; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      name="game-board"
      resetKey={gameId}
      fallback={({ reset }) => (
        <Layout>
          <ErrorFallback
            title={t('GameErrorBoundary.title')}
            message={t('GameErrorBoundary.message')}
            retryLabel={t('GameErrorBoundary.retry')}
            onRetry={reset}
          />
        </Layout>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
