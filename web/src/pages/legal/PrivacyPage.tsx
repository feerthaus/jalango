import { LEGAL } from '@/lib/legal';
import { Contact, LegalPage, Ul, type Lang, type LegalSection } from './LegalPage';

const ms: LegalSection[] = [
  {
    title: 'Siapa kami',
    body: (
      <p>
        JalanGo ialah aplikasi navigasi dan komuniti jalan raya untuk pengguna di Malaysia, dikendalikan oleh <strong>{LEGAL.operator}</strong> (“kami”).
        Dasar ini menerangkan data peribadi yang kami proses selaras dengan Akta Perlindungan Data Peribadi 2010 (PDPA). Hubungi kami: <Contact lang="ms" />.
      </p>
    ),
  },
  {
    title: 'Data yang kami kumpul',
    body: (
      <Ul>
        <li><strong>Akaun:</strong> email, nama (jika diberi) dan, jika anda log masuk dengan Google atau Facebook, maklumat profil asas yang mereka kongsi (nama, email, gambar profil).</li>
        <li><strong>Lokasi:</strong> kedudukan GPS peranti anda digunakan dalam app untuk memaparkan peta, mencari tempat berdekatan dan navigasi. Untuk carian dan laluan, koordinat (titik mula, destinasi dan titik laluan) dihantar ke pelayan kami dan penyedia peta.</li>
        <li><strong>Kandungan yang anda kongsi:</strong> laporan jalan raya (jenis, nota, lokasi, masa), undian, jalan pintas (shortcut) dan tempat yang anda syorkan.</li>
        <li><strong>Sejarah perjalanan:</strong> destinasi, masa, jarak, tempoh dan rating. Disimpan dalam peranti, dan dalam akaun anda jika log masuk. <strong>Jejak GPS perjalanan disimpan dalam peranti sahaja</strong> dan hanya dikongsi jika anda sendiri memilih untuk berkongsi jalan pintas.</li>
        <li><strong>Data trafik tanpa nama (pilihan):</strong> jika anda bersetuju, kelajuan dan kedudukan semasa navigasi dihantar <strong>tanpa akaun</strong>, menggunakan ID perjalanan rawak. Kedudukan dalam lingkungan 300 m dari titik mula dan destinasi tidak dihantar.</li>
        <li><strong>Dalam peranti sahaja:</strong> tempat kegemaran, sejarah carian, tetapan dan perjalanan yang sedang berjalan disimpan dalam pelayar anda.</li>
        <li><strong>Maklum balas dan laporan salah guna:</strong> mesej yang anda hantar melalui “Send feedback” (termasuk email/telefon jika anda beri) dan laporan kandungan yang anda tandakan.</li>
        <li><strong>Teknikal:</strong> alamat IP dan maklumat permintaan direkod sementara oleh pelayan untuk keselamatan dan had penggunaan (anti-spam).</li>
      </Ul>
    ),
  },
  {
    title: 'Tujuan penggunaan',
    body: (
      <Ul>
        <li>Menyediakan peta, carian, laluan, navigasi dan amaran jalan raya.</li>
        <li>Memaparkan laporan, jalan pintas dan tempat komuniti kepada pengguna lain.</li>
        <li>Menguruskan akaun dan sejarah perjalanan anda.</li>
        <li>Membina maklumat trafik JalanGo sendiri daripada data tanpa nama (jika anda bersetuju).</li>
        <li>Mencegah spam dan penyalahgunaan (termasuk menyemak kandungan yang dilaporkan dan menggantung akaun yang melanggar terma), dan melindungi keselamatan perkhidmatan.</li>
      </Ul>
    ),
  },
  {
    title: 'Apa yang dipaparkan kepada umum',
    body: (
      <p>
        Laporan jalan raya, jalan pintas dan tempat yang anda kongsi boleh dilihat oleh semua pengguna, termasuk tanpa log masuk. Nama dan email anda <strong>tidak</strong> dipaparkan
        bersama kandungan ini. Bagi jalan pintas, 300 m pertama dan terakhir dibuang secara automatik supaya lokasi rumah atau pejabat tidak terdedah. Jangan masukkan maklumat peribadi
        dalam nota atau ulasan.
      </p>
    ),
  },
  {
    title: 'Pihak ketiga yang memproses data',
    body: (
      <>
        <p>Kami tidak menjual data peribadi anda. Kami menggunakan penyedia berikut untuk menjalankan perkhidmatan:</p>
        <Ul>
          <li><strong>Supabase</strong>: pangkalan data dan log masuk (akaun, kandungan komuniti, sejarah perjalanan).</li>
          <li><strong>Mapbox</strong>: peta, carian tempat dan laluan. Menerima pertanyaan carian dan koordinat yang diperlukan.</li>
          <li><strong>Netlify</strong>: pengehosan aplikasi dan pelayan API.</li>
          <li><strong>Google / Facebook</strong>: hanya jika anda memilih log masuk dengan mereka.</li>
        </Ul>
        <p>Setiap penyedia memproses data mengikut dasar privasi masing-masing.</p>
      </>
    ),
  },
  {
    title: 'Pemindahan data ke luar Malaysia',
    body: (
      <p>
        Data akaun dan komuniti disimpan di {LEGAL.dataRegion}. Penyedia peta dan pengehosan mungkin memproses data di negara lain, termasuk Amerika Syarikat. Dengan menggunakan
        JalanGo, anda memahami pemindahan ini diperlukan untuk menyediakan perkhidmatan.
      </p>
    ),
  },
  {
    title: 'Tempoh simpanan',
    body: (
      <Ul>
        <li>Laporan jalan raya tamat tempoh secara automatik (beberapa jam hingga 7 hari) dan tidak lagi dipaparkan.</li>
        <li>Data trafik tanpa nama dipadam selepas 30 hari.</li>
        <li>Sejarah perjalanan, jalan pintas dan tempat disimpan sehingga anda memadamnya atau memadam akaun.</li>
        <li>Data dalam peranti boleh dipadam bila-bila masa melalui app atau tetapan pelayar.</li>
      </Ul>
    ),
  },
  {
    title: 'Hak anda',
    body: (
      <>
        <p>Di bawah PDPA, anda berhak untuk:</p>
        <Ul>
          <li>meminta akses kepada dan pembetulan data peribadi anda;</li>
          <li>menarik balik persetujuan, contohnya mematikan data trafik tanpa nama di <strong>Profil → Privasi</strong>, atau menghentikan akses lokasi dalam tetapan telefon;</li>
          <li>memadam kandungan yang anda kongsi dan sejarah perjalanan dalam app;</li>
          <li>memadam akaun dan semua data berkaitan sendiri di <strong>Profil → Delete account</strong>, atau meminta kami memadamnya.</li>
        </Ul>
        <p>Untuk permintaan, hubungi <Contact lang="ms" />.</p>
      </>
    ),
  },
  {
    title: 'Keselamatan',
    body: (
      <p>
        Data dihantar melalui sambungan yang disulitkan (HTTPS). Akses pangkalan data dikawal dengan peraturan keselamatan peringkat baris (RLS) supaya pengguna hanya boleh
        mengakses data yang dibenarkan. Kunci rahsia disimpan di pelayan sahaja. Tiada sistem yang 100% selamat, tetapi kami mengambil langkah munasabah untuk melindungi data anda.
      </p>
    ),
  },
  {
    title: 'Kanak-kanak',
    body: <p>JalanGo tidak ditujukan kepada kanak-kanak di bawah 13 tahun. Pengguna bawah 18 tahun hendaklah menggunakan perkhidmatan dengan kebenaran ibu bapa atau penjaga.</p>,
  },
  {
    title: 'Perubahan dasar',
    body: <p>Kami mungkin mengemas kini dasar ini. Tarikh “Dikemas kini” di atas akan berubah, dan perubahan besar akan dimaklumkan dalam app.</p>,
  },
];

const en: LegalSection[] = [
  {
    title: 'Who we are',
    body: (
      <p>
        JalanGo is a navigation and road-community app for users in Malaysia, operated by <strong>{LEGAL.operator}</strong> (“we”). This policy explains the personal data we
        process, in line with Malaysia’s Personal Data Protection Act 2010 (PDPA). Contact: <Contact lang="en" />.
      </p>
    ),
  },
  {
    title: 'Data we collect',
    body: (
      <Ul>
        <li><strong>Account:</strong> email, name (if given) and, if you sign in with Google or Facebook, the basic profile they share (name, email, profile picture).</li>
        <li><strong>Location:</strong> your device GPS is used in the app to show the map, find nearby places and navigate. For search and routing, coordinates (start, destination and waypoints) are sent to our server and the map provider.</li>
        <li><strong>Content you share:</strong> road reports (type, note, location, time), votes, shortcuts and places you recommend.</li>
        <li><strong>Trip history:</strong> destination, times, distance, duration and rating — on your device, and in your account if signed in. <strong>The GPS trace of a trip stays on your device</strong> and is only shared if you choose to share a shortcut.</li>
        <li><strong>Anonymous traffic data (optional):</strong> if you agree, speed and position while navigating are sent <strong>without your account</strong>, under a random trip ID. Positions within 300 m of the start and destination are never sent.</li>
        <li><strong>On your device only:</strong> favourites, search history, settings and the trip in progress are stored in your browser.</li>
        <li><strong>Feedback and abuse reports:</strong> messages you send via “Send feedback” (including an email/phone if you give one) and content you flag.</li>
        <li><strong>Technical:</strong> IP address and request details are logged temporarily by our servers for security and rate limiting (anti-spam).</li>
      </Ul>
    ),
  },
  {
    title: 'How we use it',
    body: (
      <Ul>
        <li>To provide maps, search, routes, navigation and road alerts.</li>
        <li>To show reports, shortcuts and community places to other users.</li>
        <li>To manage your account and trip history.</li>
        <li>To build JalanGo’s own traffic information from anonymous data (if you agree).</li>
        <li>To prevent spam and abuse (including reviewing reported content and suspending accounts that break the terms) and keep the service secure.</li>
      </Ul>
    ),
  },
  {
    title: 'What is public',
    body: (
      <p>
        Road reports, shortcuts and places you share are visible to all users, including people who aren’t signed in. Your name and email are <strong>not</strong> shown with this
        content. For shortcuts, the first and last 300 m are removed automatically so your home or office isn’t revealed. Please don’t put personal information in notes or reviews.
      </p>
    ),
  },
  {
    title: 'Third parties that process data',
    body: (
      <>
        <p>We do not sell your personal data. We use these providers to run the service:</p>
        <Ul>
          <li><strong>Supabase</strong> — database and sign-in (accounts, community content, trip history).</li>
          <li><strong>Mapbox</strong> — maps, place search and routing; receives search queries and the coordinates needed.</li>
          <li><strong>Netlify</strong> — hosting of the app and API server.</li>
          <li><strong>Google / Facebook</strong> — only if you choose to sign in with them.</li>
        </Ul>
        <p>Each provider processes data under its own privacy policy.</p>
      </>
    ),
  },
  {
    title: 'Transfers outside Malaysia',
    body: (
      <p>
        Account and community data is stored in {LEGAL.dataRegion}. Map and hosting providers may process data in other countries, including the United States. By using JalanGo you
        understand these transfers are needed to provide the service.
      </p>
    ),
  },
  {
    title: 'How long we keep data',
    body: (
      <Ul>
        <li>Road reports expire automatically (hours to 7 days) and are no longer shown.</li>
        <li>Anonymous traffic data is deleted after 30 days.</li>
        <li>Trip history, shortcuts and places are kept until you delete them or your account.</li>
        <li>On-device data can be cleared at any time in the app or your browser settings.</li>
      </Ul>
    ),
  },
  {
    title: 'Your rights',
    body: (
      <>
        <p>Under the PDPA you may:</p>
        <Ul>
          <li>request access to and correction of your personal data;</li>
          <li>withdraw consent — e.g. turn off anonymous traffic data in <strong>Profile → Privacy</strong>, or stop location access in your phone settings;</li>
          <li>delete content you shared and your trip history in the app;</li>
          <li>delete your account and all linked data yourself in <strong>Profile → Delete account</strong>, or ask us to.</li>
        </Ul>
        <p>For requests, contact <Contact lang="en" />.</p>
      </>
    ),
  },
  {
    title: 'Security',
    body: (
      <p>
        Data is sent over encrypted connections (HTTPS). Database access is controlled by row-level security rules so users can only reach data they’re allowed to. Secret keys are
        kept on the server only. No system is 100% secure, but we take reasonable steps to protect your data.
      </p>
    ),
  },
  {
    title: 'Children',
    body: <p>JalanGo is not directed at children under 13. Users under 18 should use the service with a parent’s or guardian’s permission.</p>,
  },
  {
    title: 'Changes to this policy',
    body: <p>We may update this policy. The “Last updated” date above will change, and significant changes will be announced in the app.</p>,
  },
];

const content: Record<Lang, LegalSection[]> = { ms, en };

export function PrivacyPage() {
  return <LegalPage title={{ ms: 'Dasar Privasi', en: 'Privacy Policy' }} content={content} />;
}
