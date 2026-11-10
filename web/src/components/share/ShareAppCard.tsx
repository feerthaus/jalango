import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { LogoMark } from '@/components/brand/LogoMark';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';
import { APP_URL } from '@/utils/shareLinks';
import { ShareSheet } from './ShareSheet';

/** "Kongsi JalanGo": invite friends and family on WhatsApp, Facebook, Instagram… */
export function ShareAppCard() {
  const [t] = useT();
  const [open, setOpen] = useState(false);
  const content = {
    title: 'JalanGo',
    text: t(
      'Saya guna JalanGo: navigasi untuk jalan Malaysia, dengan laporan trafik dan laluan elak jem dari komuniti. Percuma, buka terus di pelayar:',
      'I use JalanGo: navigation for Malaysian roads, with traffic reports and jam-beating routes from the community. Free, opens right in your browser:',
    ),
    url: APP_URL,
  };
  return (
    <div className="mt-3 rounded-2xl bg-gradient-to-br from-jade-500/15 to-sky-500/10 p-4 ring-1 ring-jade-500/30">
      <div className="flex items-center gap-3">
        <LogoMark className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t('Kongsi JalanGo', 'Share JalanGo')}</p>
          <p className="text-xs text-ink-600 dark:text-ink-300">{t('Lebih ramai pengguna, lebih banyak laporan jem dan laluan komuniti.', 'More users means more jam reports and community routes.')}</p>
        </div>
        <Button className="px-3 py-2 text-xs" onClick={() => setOpen(true)}>
          <Share2 className="size-4" /> {t('Kongsi', 'Share')}
        </Button>
      </div>
      {open && <ShareSheet heading={t('Kongsi JalanGo', 'Share JalanGo')} content={content} onClose={() => setOpen(false)} />}
    </div>
  );
}
