import { ArrowLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '@/components/brand/LogoMark';
import { cn } from '@/lib/cn';
import { LEGAL } from '@/lib/legal';

export type Lang = 'ms' | 'en';
export interface LegalSection {
  title: string;
  body: ReactNode;
}

const LANG_KEY = 'jalango:legal-lang';

/** Standalone, readable page (no map) so reviewers and users can open it directly. */
export function LegalPage({ title, content }: { title: Record<Lang, string>; content: Record<Lang, LegalSection[]> }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ms';
    } catch {
      return 'ms';
    }
  });
  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-dvh overflow-y-auto bg-ink-50 dark:bg-ink-950">
      <header className="safe-top sticky top-0 z-10 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/profile" aria-label="Back to JalanGo" className="grid size-10 place-items-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800">
            <ArrowLeft className="size-5" />
          </Link>
          <Wordmark className="flex-1" />
          <div role="radiogroup" aria-label="Language" className="flex rounded-xl bg-ink-100 p-1 text-sm font-semibold dark:bg-ink-800">
            {(['ms', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                onClick={() => choose(l)}
                className={cn('rounded-lg px-3 py-1', lang === l ? 'bg-white shadow-sm dark:bg-ink-600' : 'text-ink-500')}
              >
                {l === 'ms' ? 'BM' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-8" lang={lang === 'ms' ? 'ms' : 'en'}>
        <h1 className="text-3xl font-black tracking-tight">{title[lang]}</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {lang === 'ms' ? 'Dikemas kini' : 'Last updated'}: {LEGAL.lastUpdated} · {LEGAL.operator}
        </p>
        <nav aria-label={lang === 'ms' ? 'Kandungan' : 'Contents'} className="mt-6 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <ol className="list-decimal space-y-1 pl-5">
            {content[lang].map((s, i) => (
              <li key={i}>
                <a href={`#s${i + 1}`} className="text-jade-700 hover:underline dark:text-jade-400">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {content[lang].map((s, i) => (
          <section key={i} id={`s${i + 1}`} className="scroll-mt-20 pt-8">
            <h2 className="text-xl font-bold">
              {i + 1}. {s.title}
            </h2>
            <div className="legal-body mt-2 space-y-3 text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">{s.body}</div>
          </section>
        ))}
        <footer className="mt-12 flex flex-wrap gap-4 border-t border-ink-200 pt-6 text-sm dark:border-ink-800">
          <Link to="/privacy" className="font-semibold text-jade-700 dark:text-jade-400">
            {lang === 'ms' ? 'Dasar Privasi' : 'Privacy Policy'}
          </Link>
          <Link to="/terms" className="font-semibold text-jade-700 dark:text-jade-400">
            {lang === 'ms' ? 'Terma Penggunaan' : 'Terms of Use'}
          </Link>
          <Link to="/" className="text-ink-500">
            {lang === 'ms' ? 'Kembali ke peta' : 'Back to the map'}
          </Link>
        </footer>
      </main>
    </div>
  );
}

/** Contact line used by both documents. */
export function Contact({ lang }: { lang: Lang }) {
  if (LEGAL.contactEmail) {
    return (
      <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-jade-700 underline dark:text-jade-400">
        {LEGAL.contactEmail}
      </a>
    );
  }
  return <span>{lang === 'ms' ? 'butiran hubungan akan dipaparkan di sini sebelum pelancaran umum' : 'contact details will be published here before public launch'}</span>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
