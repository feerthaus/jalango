import { AtSign, Camera, Check, Copy, Mail, MessageCircle, MessageSquare, Send, Share2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { shareUrl, type ShareContent, type SharePlatform } from '@/utils/shareLinks';

/**
 * Share to WhatsApp, Facebook, Instagram, Telegram, X, Threads, SMS, email,
 * the phone's own share menu, or copy. Plain links: no SDKs, no tracking.
 */
export function ShareSheet({ content, heading, onClose, children }: { content: ShareContent; heading?: string; onClose: () => void; children?: ReactNode }) {
  const [t] = useT();
  const [copied, setCopied] = useState(false);
  const [igHint, setIgHint] = useState(false);
  const native = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const message = `${content.text} ${content.url}`.trim();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      return true;
    } catch {
      return false;
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: content.title, text: content.text, url: content.url });
    } catch {
      /* closed */
    }
  };

  // Instagram has no web share link: use the phone's share menu (Instagram is listed there), else copy for a DM/story
  const instagram = async () => {
    if (native) return nativeShare();
    if (await copy()) setIgHint(true);
  };

  const links: [SharePlatform, string, ReactNode, string][] = [
    ['whatsapp', 'WhatsApp', <MessageCircle key="w" className="size-6" />, 'bg-[#25D366] text-white'],
    ['facebook', 'Facebook', <span key="f" className="text-xl font-black leading-none">f</span>, 'bg-[#1877F2] text-white'],
    ['telegram', 'Telegram', <Send key="t" className="size-6" />, 'bg-[#229ED9] text-white'],
    ['x', 'X', <span key="x" className="text-lg font-black leading-none">𝕏</span>, 'bg-black text-white dark:bg-white dark:text-black'],
    ['threads', 'Threads', <AtSign key="th" className="size-6" />, 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'],
    ['sms', 'SMS', <MessageSquare key="s" className="size-6" />, 'bg-jade-500 text-white'],
    ['email', 'Email', <Mail key="e" className="size-6" />, 'bg-ink-500 text-white'],
  ];

  return (
    <Sheet title={heading ?? t('Kongsi', 'Share')} onClose={onClose}>
      {children}
      <p className="mb-4 rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
        {content.text} <span className="break-all text-jade-600 dark:text-jade-400">{content.url}</span>
      </p>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
        <li>
          <Target label="Instagram" onClick={() => void instagram()} className="bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white">
            <Camera className="size-6" />
          </Target>
        </li>
        {links.map(([id, label, icon, color]) => (
          <li key={id}>
            <Target label={label} href={shareUrl(id, content)} className={color}>
              {icon}
            </Target>
          </li>
        ))}
        <li>
          <Target label={copied ? t('Disalin', 'Copied') : t('Salin', 'Copy')} onClick={() => void copy()} className="bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-100">
            {copied ? <Check className="size-6" /> : <Copy className="size-6" />}
          </Target>
        </li>
        {native && (
          <li>
            <Target label={t('Lain-lain', 'More')} onClick={() => void nativeShare()} className="bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-100">
              <Share2 className="size-6" />
            </Target>
          </li>
        )}
      </ul>
      {igHint && (
        <p role="status" className="mt-4 rounded-xl bg-amber-400/15 p-3 text-xs text-amber-900 dark:text-amber-200">
          {t('Pautan disalin. Buka Instagram dan tampal dalam DM, Story (pelekat Pautan) atau bio.', 'Link copied. Open Instagram and paste it in a DM, a Story (Link sticker) or your bio.')}
        </p>
      )}
    </Sheet>
  );
}

function Target({ label, href, onClick, className, children }: { label: string; href?: string; onClick?: () => void; className: string; children: ReactNode }) {
  const inner = (
    <>
      <span className={cn('grid size-14 place-items-center rounded-2xl shadow-sm', className)}>{children}</span>
      <span className="mt-1 block truncate text-center text-xs font-medium">{label}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center">
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className="flex w-full flex-col items-center">
      {inner}
    </button>
  );
}
