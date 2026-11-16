import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PublicOperator } from '@/services/marketService';
import { useT } from '@/lib/i18n';

/** What JalanGo checked, plainly: ✓ verified, ✗ not provided. */
export function TrustBadges({ operator, listingInsured, compact = false }: { operator: PublicOperator; listingInsured?: boolean; compact?: boolean }) {
  const [t] = useT();
  const items: { ok: boolean; label: string }[] =
    operator.kind === 'car_rental'
      ? [
          { ok: operator.ssm_verified, label: 'SSM' },
          { ok: operator.apad_licensed, label: t('Lesen APAD', 'APAD licence') },
          { ok: operator.insured || Boolean(listingInsured), label: t('Insurans', 'Insurance') },
        ]
      : operator.kind === 'food'
        ? [{ ok: true, label: t('IC & premis disemak', 'IC & premises checked') }, ...(operator.halal_verified ? [{ ok: true, label: 'Halal JAKIM' }] : [])]
        : [{ ok: true, label: t('IC & pemilikan disemak', 'IC & ownership checked') }];
  return (
    <ul className={cn('flex flex-wrap gap-1', compact ? 'text-[10px]' : 'text-xs')} aria-label={t('Semakan JalanGo', 'JalanGo checks')}>
      {items.map((b) => (
        <li key={b.label} className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold', b.ok ? 'bg-jade-500/15 text-jade-700 dark:text-jade-300' : 'bg-ink-200 text-ink-600 dark:bg-ink-800 dark:text-ink-300')}>
          {b.ok ? <Check className="size-3" /> : <X className="size-3" />}
          {b.label}
        </li>
      ))}
    </ul>
  );
}

export function isListingInsured(insuranceExpiresOn: string | null): boolean {
  return Boolean(insuranceExpiresOn && insuranceExpiresOn > new Date().toISOString().slice(0, 10));
}
