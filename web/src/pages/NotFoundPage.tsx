import { usePageMeta } from '@/hooks/usePageMeta';
import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';
import { useT } from '@/lib/i18n';

export function NotFoundPage() {
  const [t] = useT();
  usePageMeta({ title: t('Halaman tidak dijumpai', 'Page not found'), noindex: true });
  return (
    <PagePanel title={t('Sesat?', 'Lost?')}>
      <EmptyState icon={Compass} title={t('Halaman ini tidak wujud', 'This page doesn’t exist')}>
        <Link to="/" className="font-semibold text-jade-600 underline">
          {t('Kembali ke peta', 'Back to the map')}
        </Link>
      </EmptyState>
    </PagePanel>
  );
}
