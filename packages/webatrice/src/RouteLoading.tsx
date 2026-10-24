import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@app/feature-wrappers/layout';

export default function RouteLoading() {
  const { t } = useTranslation();
  return (
    <Layout>
      <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin text-accent" aria-hidden="true" />
        {t('RouteLoading.loading')}
      </div>
    </Layout>
  );
}
