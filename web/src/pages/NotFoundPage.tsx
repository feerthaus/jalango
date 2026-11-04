import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';

export function NotFoundPage() {
  return (
    <PagePanel title="Lost?">
      <EmptyState icon={Compass} title="This page doesn’t exist">
        <Link to="/" className="font-semibold text-jade-600 underline">
          Back to the map
        </Link>
      </EmptyState>
    </PagePanel>
  );
}
