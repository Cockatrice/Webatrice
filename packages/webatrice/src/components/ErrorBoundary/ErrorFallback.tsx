import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';

import { RouteEnum } from '@app/types';

export interface ErrorFallbackProps {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

export default function ErrorFallback({ title, message, retryLabel, onRetry }: ErrorFallbackProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <div role="alert" className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <CircleAlert size={32} className="text-danger" />
      <div className="text-text-primary font-medium">{title}</div>
      <div className="text-sm text-text-muted max-w-md">{message}</div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-accent text-on-accent hover:bg-accent-hover transition-colors"
        >
          {retryLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (pathname === RouteEnum.SERVER) {
              onRetry();
            } else {
              navigate(RouteEnum.SERVER);
            }
          }}
          className="px-4 py-2 rounded-md text-sm border border-border-subtle text-text-primary hover:bg-bg-elevated transition-colors"
        >
          {t('ErrorFallback.returnToLobby')}
        </button>
      </div>
    </div>
  );
}
