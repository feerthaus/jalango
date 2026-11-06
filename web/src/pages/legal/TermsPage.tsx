import { Link } from 'react-router';
import { LEGAL } from '@/lib/legal';
import { Contact, LegalPage, Ul, type Lang, type LegalSection } from './LegalPage';

const ms: LegalSection[] = [
  {
    title: 'Penerimaan terma',
    body: (
      <p>
        Dengan menggunakan JalanGo, anda bersetuju dengan Terma Penggunaan ini dan <Link to="/privacy" className="font-semibold text-jade-700 underline dark:text-jade-400">Dasar Privasi</Link> kami.
        Jika tidak bersetuju, sila jangan gunakan perkhidmatan ini. JalanGo dikendalikan oleh <strong>{LEGAL.operator}</strong> dan sedang dalam fasa <strong>beta</strong>.
      </p>
    ),
  },
  {
    title: 'Keselamatan di jalan raya',
    body: (
      <Ul>
        <li><strong>Jangan pegang atau menaip pada telefon semasa memandu.</strong> Letak telefon di pemegang, tetapkan destinasi sebelum bergerak, atau minta penumpang membantu.</li>
        <li>Sentiasa patuhi undang-undang jalan raya, papan tanda, lampu isyarat dan arahan pihak berkuasa. Ia mengatasi arahan dalam app.</li>
        <li>Gunakan pertimbangan sendiri. Jangan ikut arahan yang kelihatan tidak selamat, menyalahi undang-undang atau mustahil.</li>
        <li>Jangan buat laporan atau undian ketika memandu jika ia tidak selamat.</li>
      </Ul>
    ),
  },
  {
    title: 'Ketepatan maklumat',
    body: (
      <p>
        Peta, laluan, masa perjalanan, maklumat trafik dan tol disediakan oleh pihak ketiga dan mungkin tidak tepat, tidak lengkap atau ketinggalan. Laporan, jalan pintas dan tempat
        dikongsi oleh pengguna dan <strong>tidak disahkan oleh pihak berkuasa</strong>. JalanGo tidak sesuai untuk kegunaan kecemasan. Untuk kecemasan, hubungi 999.
      </p>
    ),
  },
  {
    title: 'Kandungan pengguna',
    body: (
      <>
        <p>Anda bertanggungjawab ke atas kandungan yang anda kongsi. Anda bersetuju untuk tidak berkongsi:</p>
        <Ul>
          <li>laporan palsu, mengelirukan atau sengaja diulang;</li>
          <li>iklan, spam atau promosi tanpa kebenaran;</li>
          <li>maklumat peribadi orang lain, gambar atau butiran yang boleh mengenal pasti individu;</li>
          <li>kandungan yang menyalahi undang-undang, berbaur kebencian, lucah atau memfitnah;</li>
          <li>jalan pintas melalui kawasan persendirian, larangan masuk atau yang berbahaya.</li>
        </Ul>
        <p>
          Dengan berkongsi kandungan, anda memberi kami lesen bukan eksklusif dan bebas royalti untuk menyimpan, memaparkan dan menggunakan kandungan itu bagi menyediakan dan
          menambah baik JalanGo. Kami boleh membuang kandungan dan menggantung akaun yang melanggar terma ini.
        </p>
      </>
    ),
  },
  {
    title: 'Akaun',
    body: (
      <p>
        Anda bertanggungjawab menjaga keselamatan akaun dan kata laluan anda. Satu orang, satu akaun. Jangan menyamar sebagai orang lain atau menggunakan perkhidmatan secara automatik
        (bot, scraping).
      </p>
    ),
  },
  {
    title: 'Perkhidmatan pihak ketiga',
    body: (
      <p>
        JalanGo menggunakan perkhidmatan pihak ketiga seperti Mapbox (peta dan laluan), Supabase (pangkalan data dan log masuk), Netlify (pengehosan) serta Google dan Facebook (log
        masuk pilihan). Penggunaan anda juga tertakluk kepada terma pihak tersebut. Atribusi peta dipaparkan pada peta.
      </p>
    ),
  },
  {
    title: 'Perkhidmatan “seadanya”',
    body: (
      <p>
        JalanGo disediakan “seadanya” dan “sebagaimana tersedia”, tanpa sebarang jaminan, termasuk jaminan ketepatan, ketersediaan berterusan atau kesesuaian untuk tujuan tertentu.
        Ciri boleh berubah, dihentikan sementara atau ditamatkan.
      </p>
    ),
  },
  {
    title: 'Had tanggungan',
    body: (
      <p>
        Setakat yang dibenarkan oleh undang-undang Malaysia, {LEGAL.operator} tidak bertanggungjawab atas sebarang kerugian, kerosakan, kecederaan, saman, kelewatan atau kos yang timbul
        daripada penggunaan, atau ketidakupayaan menggunakan, JalanGo atau kandungan pengguna lain. Tiada apa-apa dalam terma ini mengehadkan hak anda yang tidak boleh dikecualikan
        di bawah undang-undang.
      </p>
    ),
  },
  {
    title: 'Undang-undang yang terpakai',
    body: <p>Terma ini ditadbir oleh undang-undang Malaysia, dan sebarang pertikaian tertakluk kepada bidang kuasa mahkamah Malaysia.</p>,
  },
  {
    title: 'Perubahan dan hubungan',
    body: (
      <p>
        Kami mungkin mengemas kini terma ini. Penggunaan berterusan selepas perubahan bermakna anda bersetuju dengan terma baharu. Soalan atau aduan: <Contact lang="ms" />.
      </p>
    ),
  },
];

const en: LegalSection[] = [
  {
    title: 'Accepting these terms',
    body: (
      <p>
        By using JalanGo you agree to these Terms of Use and our <Link to="/privacy" className="font-semibold text-jade-700 underline dark:text-jade-400">Privacy Policy</Link>. If you
        don’t agree, please don’t use the service. JalanGo is operated by <strong>{LEGAL.operator}</strong> and is currently in <strong>beta</strong>.
      </p>
    ),
  },
  {
    title: 'Road safety',
    body: (
      <Ul>
        <li><strong>Don’t hold or type on your phone while driving.</strong> Use a phone mount, set your destination before you move, or ask a passenger.</li>
        <li>Always obey traffic laws, road signs, signals and instructions from the authorities — they take priority over the app.</li>
        <li>Use your own judgement. Don’t follow directions that seem unsafe, illegal or impossible.</li>
        <li>Don’t report or vote while driving if it isn’t safe to do so.</li>
      </Ul>
    ),
  },
  {
    title: 'Accuracy of information',
    body: (
      <p>
        Maps, routes, travel times, traffic and toll information come from third parties and may be inaccurate, incomplete or out of date. Reports, shortcuts and places are shared by
        users and are <strong>not verified by the authorities</strong>. JalanGo is not suitable for emergencies — in an emergency call 999.
      </p>
    ),
  },
  {
    title: 'User content',
    body: (
      <>
        <p>You are responsible for what you share. You agree not to share:</p>
        <Ul>
          <li>false, misleading or deliberately repeated reports;</li>
          <li>ads, spam or unauthorised promotion;</li>
          <li>other people’s personal information, photos or details that identify individuals;</li>
          <li>illegal, hateful, obscene or defamatory content;</li>
          <li>shortcuts through private property, no-entry areas or dangerous roads.</li>
        </Ul>
        <p>
          By sharing content you give us a non-exclusive, royalty-free licence to store, display and use it to provide and improve JalanGo. We may remove content and suspend accounts
          that break these terms.
        </p>
      </>
    ),
  },
  {
    title: 'Accounts',
    body: <p>You are responsible for keeping your account and password secure. One person, one account. Don’t impersonate others or use the service through automation (bots, scraping).</p>,
  },
  {
    title: 'Third-party services',
    body: (
      <p>
        JalanGo uses third-party services such as Mapbox (maps and routing), Supabase (database and sign-in), Netlify (hosting) and Google and Facebook (optional sign-in). Your use is also
        subject to their terms. Map attributions are shown on the map.
      </p>
    ),
  },
  {
    title: 'Service “as is”',
    body: (
      <p>
        JalanGo is provided “as is” and “as available”, without warranties of any kind, including accuracy, uninterrupted availability or fitness for a particular purpose. Features may
        change, be suspended or be discontinued.
      </p>
    ),
  },
  {
    title: 'Limitation of liability',
    body: (
      <p>
        To the extent permitted by Malaysian law, {LEGAL.operator} is not liable for any loss, damage, injury, fines, delays or costs arising from using, or being unable to use, JalanGo
        or other users’ content. Nothing in these terms limits rights you have that cannot be excluded by law.
      </p>
    ),
  },
  {
    title: 'Governing law',
    body: <p>These terms are governed by the laws of Malaysia, and disputes are subject to the jurisdiction of the Malaysian courts.</p>,
  },
  {
    title: 'Changes and contact',
    body: <p>We may update these terms. Continuing to use JalanGo after a change means you accept the new terms. Questions or complaints: <Contact lang="en" />.</p>,
  },
];

const content: Record<Lang, LegalSection[]> = { ms, en };

export function TermsPage() {
  return <LegalPage title={{ ms: 'Terma Penggunaan', en: 'Terms of Use' }} content={content} />;
}
