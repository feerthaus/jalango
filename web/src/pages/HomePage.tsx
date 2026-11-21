import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Camera,
  Car,
  Fuel,
  Heart,
  Map as MapIcon,
  Megaphone,
  MessageSquare,
  Mic,
  Route as RouteIcon,
  Share2,
  ShieldCheck,
  Store,
  TrainFront,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LogoMark, Wordmark } from '@/components/brand/LogoMark';
import { ShareSheet } from '@/components/share/ShareSheet';
import { useVoiceLang } from '@/hooks/useVoiceAlerts';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/cn';
import { useT, type Msg } from '@/lib/i18n';
import { LEGAL } from '@/lib/legal';
import { SITE_URL } from '@/lib/site';

interface Feature {
  icon: LucideIcon;
  title: Msg;
  text: Msg;
}

/** What JalanGo does on the road (all live in the app today). */
const NAV_FEATURES: Feature[] = [
  { icon: Mic, title: { ms: 'Panduan suara BM', en: 'Malay voice guidance' }, text: { ms: 'Arahan belok demi belok dalam Bahasa Melayu, dengan panduan lorong dan lampu isyarat.', en: 'Turn-by-turn directions in Malay or English, with lane guidance and traffic lights.' } },
  { icon: Megaphone, title: { ms: 'Laporan komuniti', en: 'Community reports' }, text: { ms: 'Kemalangan, polis, banjir, kerja jalan dan kamera AWAS, dilapor dan disahkan pemandu lain.', en: 'Accidents, police, floods, roadworks and AWAS cameras, reported and confirmed by other drivers.' } },
  { icon: RouteIcon, title: { ms: 'Elak jem', en: 'Beat the jam' }, text: { ms: 'Trafik langsung, laluan alternatif dan laluan komuniti untuk balik kampung.', en: 'Live traffic, alternative routes and community routes for the long drive home.' } },
  { icon: Fuel, title: { ms: 'Minyak, tol & R&R', en: 'Fuel, tolls & R&R' }, text: { ms: 'Harga minyak terkini, anggaran tol, dan tempat singgah sepanjang laluan.', en: 'Current fuel prices, toll estimates and places to stop along the way.' } },
  { icon: Users, title: { ms: 'Konvoi & kongsi live', en: 'Convoys & live sharing' }, text: { ms: 'Pandu bersama keluarga dan kawan di satu peta, dengan chat konvoi yang selamat.', en: 'Drive together on one map, with convoy chat that’s safe while driving.' } },
  { icon: TrainFront, title: { ms: 'Pengangkutan awam', en: 'Public transport' }, text: { ms: 'LRT, MRT, KTM, bas dan KLIA Ekspres, dengan amaran sebelum stesen turun.', en: 'LRT, MRT, KTM, buses and KLIA Ekspres, with a heads-up before your stop.' } },
];

interface Discover extends Feature {
  to: string;
  cta: Msg;
  tone: string;
}

/** Ways to find places, each leading to a screen that exists today. */
const DISCOVER: Discover[] = [
  {
    icon: BedDouble,
    title: { ms: 'Hotel & homestay', en: 'Hotels & homestays' },
    text: { ms: 'Cari hotel di peta, dan homestay yang pemiliknya disemak JalanGo.', en: 'Find hotels on the map, and homestays whose owners JalanGo has checked.' },
    to: '/sewa?jenis=homestay',
    cta: { ms: 'Lihat homestay', en: 'See homestays' },
    tone: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
  },
  {
    icon: Camera,
    title: { ms: 'Tempat menarik', en: 'Attractions & places' },
    text: { ms: 'Tempat menarik sepanjang laluan anda, dan tempat yang disyorkan komuniti JalanGo.', en: 'Sights along your route, and places the JalanGo community recommends.' },
    to: '/explore',
    cta: { ms: 'Teroka', en: 'Explore' },
    tone: 'bg-pink-500/12 text-pink-700 dark:text-pink-300',
  },
  {
    icon: Utensils,
    title: { ms: 'Makan', en: 'Food & dining' },
    text: { ms: 'Kedai makan yang disemak, dan tempat makan di sepanjang perjalanan.', en: 'Checked food businesses, and places to eat along the way.' },
    to: '/sewa?jenis=food',
    cta: { ms: 'Cari makan', en: 'Find food' },
    tone: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
  },
  {
    icon: Car,
    title: { ms: 'Kereta sewa & pengangkutan', en: 'Car rental & transport' },
    text: { ms: 'Kereta sewa yang disemak, serta tren dan bas dalam pilihan laluan "Awam".', en: 'Checked rental cars, plus trains and buses under the "Transit" route option.' },
    to: '/sewa?jenis=car_rental',
    cta: { ms: 'Lihat kereta sewa', en: 'See rental cars' },
    tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  },
];

/** The existing registration, in four steps (BusinessPage + admin review). */
const BUSINESS_STEPS: Msg[] = [
  { ms: 'Daftar akaun dan isi maklumat bisnes anda.', en: 'Create an account and fill in your business details.' },
  { ms: 'Muat naik dokumen pengesahan (cth. IC, SSM, gambar premis).', en: 'Upload verification documents (e.g. IC, SSM, premises photo).' },
  { ms: 'Pasukan JalanGo menyemak dan meluluskan bisnes anda.', en: 'The JalanGo team checks and approves your business.' },
  { ms: 'Listing disiarkan: pelanggan hubungi anda terus melalui WhatsApp.', en: 'Your listing goes live: customers contact you directly on WhatsApp.' },
];

/**
 * The public homepage (/home): what JalanGo is, for people on the road and
 * for business owners. The map app stays at "/" (installed apps, shared
 * place links and convoy invites all open there).
 */
export function HomePage() {
  const [t, lang] = useT();
  const [, setLang] = useVoiceLang();
  const [sharing, setSharing] = useState(false);

  usePageMeta({
    title: t('Navigasi, tempat menarik & bisnes tempatan Malaysia', 'Navigation, places & local businesses in Malaysia'),
    description: t(
      'JalanGo: navigasi percuma untuk jalan Malaysia dengan panduan suara BM dan laporan komuniti. Cari homestay, kereta sewa, makan dan tempat menarik, atau daftar bisnes anda.',
      'JalanGo: free navigation for Malaysian roads with Malay voice guidance and community reports. Find homestays, rental cars, food and places to visit, or list your business.',
    ),
    canonicalPath: '/home',
  });

  return (
    <div className="min-h-dvh overflow-y-auto bg-ink-50 text-ink-900 dark:bg-ink-950 dark:text-ink-50">
      <header className="safe-top sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Link to="/home" aria-label={t('Laman utama JalanGo', 'JalanGo home')} className="flex-1">
            <Wordmark />
          </Link>
          <div role="radiogroup" aria-label={t('Bahasa', 'Language')} className="flex rounded-xl bg-ink-100 p-1 text-sm font-semibold dark:bg-ink-800">
            {(['ms', 'en'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={cn('rounded-lg px-2.5 py-1', lang === l ? 'bg-white shadow-sm dark:bg-ink-600' : 'text-ink-500')}>
                {l === 'ms' ? t('BM', 'BM') : t('EN', 'EN')}
              </button>
            ))}
          </div>
          <Link to="/" className="hidden items-center gap-1.5 rounded-xl bg-jade-500 px-3 py-2 text-sm font-bold text-ink-950 hover:bg-jade-400 sm:flex">
            <MapIcon className="size-4" /> {t('Buka peta', 'Open map')}
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink-950 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-jade-500/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-5xl items-center gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr] md:py-20">
            <div>
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-jade-300">
                <ShieldCheck className="size-3.5" /> {t('Percuma · terus di pelayar · dibina untuk Malaysia', 'Free · right in your browser · made for Malaysia')}
              </p>
              <h1 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">{t('Navigasi untuk jalan Malaysia', 'Navigation for Malaysian roads')}</h1>
              <p className="mt-4 max-w-xl text-lg text-ink-200">
                {t(
                  'Elak jem bersama komuniti, dengar arahan dalam BM, dan jumpa tempat menginap, makan dan sewa kereta di sepanjang perjalanan.',
                  'Beat the jam with the community, hear directions in Malay, and find places to stay, eat and rent a car along the way.',
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/" className="inline-flex items-center gap-2 rounded-2xl bg-jade-500 px-5 py-3 font-bold text-ink-950 hover:bg-jade-400">
                  <MapIcon className="size-5" /> {t('Buka peta', 'Open the map')}
                </Link>
                <Link to="/business" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-bold text-white ring-1 ring-white/20 hover:bg-white/15">
                  <Store className="size-5" /> {t('Daftar bisnes', 'List your business')}
                </Link>
              </div>
            </div>
            <div className="hidden justify-center md:flex">
              <LogoMark className="size-56 drop-shadow-2xl" />
            </div>
          </div>
        </section>

        {/* On the road */}
        <Section id="navigasi" eyebrow={t('Di jalan raya', 'On the road')} title={t('Semua yang pemandu Malaysia perlukan', 'Everything Malaysian drivers need')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_FEATURES.map((f) => (
              <Card key={f.title.ms} icon={f.icon} title={t(f.title)} text={t(f.text)} tone="bg-jade-500/12 text-jade-700 dark:text-jade-300" />
            ))}
          </div>
          <Link to="/" className="mt-5 inline-flex items-center gap-1.5 font-bold text-jade-700 hover:underline dark:text-jade-400">
            {t('Mula memandu dengan JalanGo', 'Start driving with JalanGo')} <ArrowRight className="size-4" />
          </Link>
        </Section>

        {/* Discover */}
        <Section id="teroka" eyebrow={t('Cari tempat', 'Find places')} title={t('Menginap, makan, berjalan dan sewa kereta', 'Stay, eat, explore and rent a car')} muted>
          <div className="grid gap-3 sm:grid-cols-2">
            {DISCOVER.map((d) => (
              <Link key={d.to} to={d.to} className="group flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 hover:ring-jade-500 dark:bg-ink-900 dark:ring-ink-800">
                <span className={cn('grid size-11 place-items-center rounded-xl', d.tone)}>
                  <d.icon className="size-6" />
                </span>
                <h3 className="mt-3 text-lg font-bold">{t(d.title)}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-600 dark:text-ink-300">{t(d.text)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-jade-700 group-hover:underline dark:text-jade-400">
                  {t(d.cta)} <ArrowRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl bg-jade-500/10 p-4 ring-1 ring-jade-500/25 sm:flex-row sm:items-center">
            <BadgeCheck className="size-6 shrink-0 text-jade-600" />
            <p className="flex-1 text-sm">
              <strong>{t('Sewa & Makan', 'Rent & Food')}</strong>
              {' · '}
              {t('Homestay, kereta sewa dan kedai makan yang pemiliknya disemak oleh JalanGo. Hubungi terus melalui WhatsApp.', 'Homestays, rental cars and food businesses whose owners JalanGo has checked. Contact them directly on WhatsApp.')}
            </p>
            <Link to="/sewa" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-jade-500 px-4 py-2 text-sm font-bold text-ink-950 hover:bg-jade-400">
              {t('Buka Sewa & Makan', 'Open Rent & Food')} <ArrowRight className="size-4" />
            </Link>
          </div>
        </Section>

        {/* Businesses */}
        <Section id="bisnes" eyebrow={t('Untuk pemilik bisnes', 'For business owners')} title={t('Bawa pelanggan dari jalan terus ke premis anda', 'Bring customers from the road to your door')}>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-ink-600 dark:text-ink-300">
                {t(
                  'Senaraikan homestay, kereta sewa atau kedai makan anda di JalanGo. Pemandu nampak bisnes yang disemak, dan boleh terus WhatsApp, telefon atau navigasi ke premis anda.',
                  'List your homestay, rental car or food business on JalanGo. Drivers see checked businesses and can WhatsApp, call or navigate to you in one tap.',
                )}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  t('Percuma untuk bermula', 'Free to start'),
                  t('Lencana “Disahkan” selepas semakan', '“Verified” badge after review'),
                  t('Statistik tontonan, WhatsApp dan navigasi', 'Stats for views, WhatsApp taps and directions'),
                  t('Tiada iklan semasa pemandu sedang memandu', 'Never shown to drivers while they are driving'),
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-jade-600" /> {x}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-500">
                {t('Kategori sekarang: homestay, kereta sewa dan kedai makan. Hotel, tarikan dan aktiviti sedang dirancang.', 'Categories today: homestays, rental cars and food. Hotels, attractions and activities are planned.')}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
              <h3 className="font-bold">{t('Cara mendaftar', 'How to register')}</h3>
              <ol className="mt-3 space-y-3">
                {BUSINESS_STEPS.map((s, i) => (
                  <li key={s.ms} className="flex gap-3 text-sm">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-jade-500 text-sm font-black text-ink-950">{i + 1}</span>
                    <span className="pt-1">{t(s)}</span>
                  </li>
                ))}
              </ol>
              <Link to="/business" className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-jade-500 px-5 py-3 font-bold text-ink-950 hover:bg-jade-400">
                <Store className="size-5" /> {t('Daftar bisnes anda', 'Register your business')}
              </Link>
            </div>
          </div>
        </Section>

        {/* About */}
        <Section id="tentang" eyebrow={t('Tentang JalanGo', 'About JalanGo')} title={t('Dibina di Malaysia, untuk jalan Malaysia', 'Built in Malaysia, for Malaysian roads')} muted>
          <div className="grid gap-3 md:grid-cols-3">
            <Card icon={MapIcon} title={t('Pengetahuan tempatan', 'Local knowledge')} text={t('Kamera AWAS, R&R, harga minyak, tol dan nama jalan tempatan: perkara yang aplikasi global terlepas pandang.', 'AWAS cameras, R&R stops, fuel prices, tolls and local street names: what global apps miss.')} tone="bg-sky-500/12 text-sky-700 dark:text-sky-300" />
            <Card icon={Users} title={t('Dikuasakan komuniti', 'Powered by the community')} text={t('Setiap laporan, laluan dan tempat yang dikongsi pemandu menjadikan JalanGo lebih tepat untuk semua.', 'Every report, route and place drivers share makes JalanGo better for everyone.')} tone="bg-violet-500/12 text-violet-700 dark:text-violet-300" />
            <Card icon={ShieldCheck} title={t('Privasi diutamakan', 'Privacy first')} text={t('Jejak GPS kekal dalam telefon anda melainkan anda pilih untuk berkongsi. Data individu tidak dijual.', 'Your GPS trail stays on your phone unless you choose to share. Individual data is never sold.')} tone="bg-jade-500/12 text-jade-700 dark:text-jade-300" />
          </div>
        </Section>

        {/* Support (placeholder: no payments yet) */}
        <Section id="sokong" eyebrow={t('Sokong JalanGo', 'Support JalanGo')} title={t('Bantu JalanGo terus berkembang', 'Help JalanGo keep growing')}>
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200 md:flex-row md:items-center dark:bg-ink-900 dark:ring-ink-800">
            <Heart className="size-8 shrink-0 text-red-500" />
            <div className="flex-1">
              <p className="font-semibold">{t('Pilihan sumbangan akan datang.', 'A way to donate is coming soon.')}</p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                {t('Buat masa ini, cara terbaik menyokong: kongsi JalanGo dengan keluarga dan kawan, hantar laporan jalan, dan beri maklum balas.', 'For now, the best way to help: share JalanGo with family and friends, report what you see on the road, and send us feedback.')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => setSharing(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-jade-500 px-4 py-2 text-sm font-bold text-ink-950 hover:bg-jade-400">
                <Share2 className="size-4" /> {t('Kongsi JalanGo', 'Share JalanGo')}
              </button>
              <Link to="/profile" className="inline-flex items-center gap-1.5 rounded-xl bg-ink-100 px-4 py-2 text-sm font-bold hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700">
                <MessageSquare className="size-4" /> {t('Maklum balas', 'Feedback')}
              </Link>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-ink-500 sm:flex-row sm:items-center">
          <Wordmark className="text-ink-900 sm:flex-1 dark:text-white" />
          <nav aria-label={t('Pautan kaki', 'Footer links')} className="flex flex-wrap gap-4 font-semibold">
            <Link to="/" className="hover:text-jade-600">
              {t('Peta', 'Map')}
            </Link>
            <Link to="/sewa" className="hover:text-jade-600">
              {t('Sewa & Makan', 'Rent & Food')}
            </Link>
            <Link to="/business" className="hover:text-jade-600">
              {t('Bisnes', 'Business')}
            </Link>
            <Link to="/privacy" className="hover:text-jade-600">
              {t('Privasi', 'Privacy')}
            </Link>
            <Link to="/terms" className="hover:text-jade-600">
              {t('Terma', 'Terms')}
            </Link>
          </nav>
          <p>
            © {new Date().getFullYear()} {LEGAL.operator}
          </p>
        </div>
      </footer>

      {sharing && (
        <ShareSheet
          heading={t('Kongsi JalanGo', 'Share JalanGo')}
          content={{
            title: 'JalanGo',
            text: t('Saya guna JalanGo: navigasi untuk jalan Malaysia, dengan laporan trafik dan laluan elak jem dari komuniti. Percuma:', 'I use JalanGo: navigation for Malaysian roads, with traffic reports and jam-beating routes from the community. Free:'),
            url: `${SITE_URL}/home`,
          }}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}

function Section({ id, eyebrow, title, muted, children }: { id: string; eyebrow: string; title: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-16', muted && 'bg-white dark:bg-ink-900/40')}>
      <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-jade-700 dark:text-jade-400">{eyebrow}</p>
        <h2 id={`${id}-title`} className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function Card({ icon: Icon, title, text, tone }: { icon: LucideIcon; title: string; text: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <span className={cn('grid size-10 place-items-center rounded-xl', tone)}>
        <Icon className="size-5" />
      </span>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{text}</p>
    </div>
  );
}
