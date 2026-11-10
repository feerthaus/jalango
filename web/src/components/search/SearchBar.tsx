import { ArrowLeft, Search, X } from 'lucide-react';
import { forwardRef, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { LogoMark } from '@/components/brand/LogoMark';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  loading?: boolean;
  activeDescendant?: string;
  /** Shown when the box is empty (e.g. the voice search mic) */
  extra?: ReactNode;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, open, onOpen, onClose, onKeyDown, loading, activeDescendant, extra },
  ref,
) {
  const [t] = useT();
  return (
    <div
      className={cn(
        'pointer-events-auto flex h-14 items-center gap-1 rounded-2xl bg-white pl-2 pr-1.5 shadow-float ring-1 ring-ink-900/5 dark:bg-ink-800 dark:ring-white/10',
        open && 'ring-2 ring-jade-500',
      )}
    >
      {open ? (
        <button type="button" onClick={onClose} aria-label="Close search" className="grid size-10 place-items-center rounded-xl text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-700">
          <ArrowLeft className="size-5" />
        </button>
      ) : (
        <span className="grid size-10 place-items-center text-ink-400">
          <Search className="size-5" />
        </span>
      )}
      <input
        ref={ref}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onOpen}
        onKeyDown={onKeyDown}
        placeholder={t('Ke mana? Tempat, jalan, poskod…', 'Where to? Place, address, postcode…')}
        aria-label="Search destination"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        className="h-full min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {loading && <Spinner className="mx-2 size-4 text-jade-500" label="Searching" />}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="grid size-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700"
        >
          <X className="size-5" />
        </button>
      )}
      {!value && extra}
      {!open && (
        <span className="mr-1" aria-hidden>
          <LogoMark className="size-10" title="" />
        </span>
      )}
    </div>
  );
});
