# Fungsi JalanGo

Senarai fungsi yang ada dalam JalanGo: apa ia buat, cara guna, dan di mana kodnya.
Kemas kini fail ini dalam PR yang sama setiap kali fungsi baru ditambah atau diubah (lihat `AGENTS.md`).

---

## Panduan lorong 3D

**Apa:** bila simpang tinggal kurang 800 m, banner navigasi memaparkan jalan di depan dalam 3D.
- Lorong yang patut diguna menyala **hijau**, dan anak panahnya dicat atas jalan.
- Lorong lain dipaparkan kelabu.
- Garisan lorong bergerak ke arah pemandu, supaya nampak seperti sedang memandu.

| Jarak ke simpang | Paparan |
|---|---|
| Lebih 2 km | Tiada panduan lorong |
| 800 m – 2 km | Jalur anak panah lorong (rata) |
| Kurang 800 m | **Pandangan lorong 3D** |

**Bila ia keluar:** hanya di simpang yang data laluannya ada maklumat lorong (sekurang-kurangnya 2 lorong, dan satu yang sah). Ini kebanyakannya lebuh raya dan jalan utama. Di jalan kecil, banner biasa sahaja dipaparkan.

**Sumber data:** maklumat lorong (`intersections.lanes`) yang memang datang bersama laluan Mapbox Directions. **Tiada panggilan API tambahan dan tiada kos.**

**Had:**
- Ia lukisan jalan, bukan gambar simpang sebenar. Gambar simpang sebenar ("junction view") perlukan data berlesen.
- Animasi garisan dimatikan jika telefon ditetapkan untuk kurangkan gerakan (*reduce motion*).

**Kod:**
- `web/src/components/navigation/LaneView3D.tsx`: jalan SVG, dengan perspektif CSS `rotateX`.
- `web/src/utils/laneArrows.ts`: bentuk anak panah setiap jenis lorong (lurus, condong, belok, tajam, U-turn). Lorong kiri ialah cermin lorong kanan.
- `web/src/components/navigation/LaneGuide.tsx`: jalur rata dan `hasLanes()`.
- `web/src/components/navigation/NavigationHud.tsx`: memilih antara jalur rata dan 3D mengikut jarak.
- Ujian: `web/src/utils/laneArrows.test.ts`.

---

## Marketplace Fasa 1b: Sewa (untuk pengguna)

- **Pintu masuk:** kad **"Sewa kereta & homestay"** di atas halaman Teroka, atau terus ke `/sewa`.
- **Senarai:** kereta sewa dan homestay yang disiarkan (operator diluluskan sahaja), paling dekat dahulu. Tapis Semua / Kereta sewa / Homestay. Setiap kad: gambar utama, harga, kawasan, jarak, fakta ringkas dan lencana.
- **Peta:** butang **Peta** menunjukkan pin harga pada peta; tekan pin untuk kad listing.
- **Halaman listing (`/sewa/:id`):** galeri gambar, harga biasa dan hujung minggu, deposit, fakta (kereta: jenama, transmisi, tempat duduk, bahan api; homestay: jenis, bilik, tetamu, masa masuk/keluar, kemudahan, peraturan), kawasan servis kereta.
  - **Kalendar:** tarikh penuh dikelabukan; pilih tarikh mula dan akhir. Amaran jika julat termasuk tarikh penuh. Anggaran harga mengikut harga hujung minggu (homestay: malam Jumaat & Sabtu; kereta: Sabtu & Ahad).
  - **Lencana semakan:** kereta: ✓/✗ SSM, ✓/✗ Lesen APAD, ✓/✗ Insurans, dengan nota jika tiada lesen APAD. Homestay: "IC & pemilikan disemak".
  - **WhatsApp:** mesej siap dengan nama listing, tarikh dan pautan. Untuk kereta, pilihan **hantar lokasi saya** (pautan Google Maps) untuk ambil/hantar kereta.
  - Butang **telefon**, **arah** (buka di peta JalanGo) dan **kongsi**.
- **Tidak dipaparkan semasa memandu.**
- **Statistik untuk operator:** di Bisnes saya, setiap listing menunjukkan paparan, WhatsApp dan panggilan untuk 30 hari lepas. Dikira sekali sehari setiap peranti (ID rawak, tanpa akaun, IP atau lokasi).
- **Privasi:** jadual operator kekal tertutup; orang awam hanya nampak nama bisnes, bandar, nombor telefon dan lencana untuk operator yang diluluskan.

## Marketplace Fasa 1a: listing, gambar, kalendar (operator & admin)

Selepas bisnes diluluskan, **Bisnes saya** menunjukkan **Kereta saya / Unit homestay saya (n/10)**.

- **Tambah / sunting listing** (`/business/listings/:id`):
  - **Kereta:** jenama, model, tahun, tempat duduk, transmisi, bahan api, harga/hari, harga hujung minggu, deposit, insurans kereta itu (pilihan).
  - **Homestay:** jenis, tetamu maksimum, bilik tidur, bilik air, waktu daftar masuk/keluar, kemudahan, peraturan rumah, harga/malam, harga hujung minggu, deposit.
- **Lokasi:** butang **"Lokasi saya"** (GPS di premis), carian alamat atau tampal link Google Maps, atau seret pin di peta kecil. Nama kawasan diisi automatik.
  - **Homestay:** lokasi tepat.
  - **Kereta sewa:** lokasi pangkalan + **kawasan servis (km)**. Penyewa hantar lokasi ambil/hantar melalui WhatsApp (Fasa 1b).
- **Gambar:** kereta maksimum 8, homestay maksimum 12. Dikecilkan dan EXIF dibuang. **Setiap gambar disemak admin** sebelum dipaparkan. Gambar pertama ialah gambar utama (★ untuk tukar).
- **Kalendar kekosongan:** tekan tarikh untuk tanda **penuh** (12 bulan ke hadapan).
- **Status:** Draf, Menunggu semakan, Disiarkan, Dijeda, Ditolak (dengan nota).
  - Setiap perubahan maklumat dihantar untuk semakan semula.
  - **Jeda / Siar semula** tanpa semakan jika kandungan tidak berubah (hash kandungan semasa diluluskan).
- **Admin → Listing:** listing baru/berubah dan gambar baru. **Lulus / Tolak setiap gambar**, kemudian **Lulus & siar** (gambar yang menunggu turut diluluskan) atau **Tolak** (wajib nota). Semua tindakan direkod.
- **Pangkalan data:**
  - Migrasi: `20261117000000_marketplace_listings.sql`.
  - Jadual: `listings`, `listing_photos`, `listing_blocks`; bucket peribadi `listing-photos`.
  - Hanya listing **live** daripada operator **approved** dan gambar **approved** boleh dilihat orang awam.
- **Kod:** `services/listingService.ts`, `pages/ListingEditorPage.tsx`, `components/business/` (`MyListings`, `LocationPicker`, `AvailabilityCalendar`), `components/admin/ListingReview.tsx`.

## Marketplace Fasa 0: daftar operator (homestay & kereta sewa berlesen)

Pelan penuh ada dalam `docs/MARKETPLACE.md`. Fasa 0 hanya pendaftaran dan pengesahan. **Belum ada listing awam.**

- **Profil → "Ada homestay atau kereta sewa?"** membuka `/business` (halaman Bisnes saya):
  1. **Maklumat bisnes:** jenis (Homestay / Kereta sewa), nama, negeri, bandar, telefon/WhatsApp, SSM, penerangan. Kereta sewa wajib ada **SSM**. **Lesen APAD dan insurans adalah pilihan** (keputusan sementara pemilik). Jika diisi, tarikh tamat mesti masih sah. Jika salah satu tiada, operator mesti tanda **penafian**, yang direkod dengan masa pelayan (`licence_disclaimer_at`).
  2. **Dokumen pengesahan** (gambar atau PDF, maksimum 5 MB):
     - homestay: IC + bukti pemilikan/kebenaran;
     - kereta sewa: SSM (+ lesen APAD dan sijil insurans jika ada).
     Disimpan dalam bucket **peribadi** `operator-docs`, dan hanya boleh dilihat oleh pemilik dan admin (dengan 2FA).
  3. **Status:** Menunggu semakan, Perlu maklumat tambahan (dengan nota admin), Disahkan (percuma 6 bulan, tarikh dipaparkan), Ditolak, atau Digantung. Sebarang perubahan oleh operator menghantar bisnes untuk **disemak semula**.
- **Admin → Operator:** senarai "Perlu semakan" dan "Semua".
  - Setiap operator menunjukkan butiran, dokumen (pautan sementara), dokumen yang belum ada, dan amaran lesen/insurans tamat.
  - Butang **Lulus** (dimatikan jika dokumen belum lengkap atau lesen tamat), **Minta maklumat**, **Tolak** dan **Gantung**. Tiga yang terakhir wajib dengan nota.
  - Kelulusan memulakan **6 bulan percuma** (`free_until`).
  - Setiap keputusan direkod dalam jadual `admin_actions`.
- **Kod:**
  - Migrasi: `supabase/migrations/20261114000000_marketplace_operators.sql`.
  - `web/src/services/operatorService.ts`, `web/src/pages/BusinessPage.tsx`, `web/src/components/admin/OperatorReview.tsx`, `web/src/lib/operatorLabels.ts`.

---

## Rekod kemalangan dan amaran kawasan kerap kemalangan

**Apa:** sejarah kemalangan di sesuatu lokasi, dipaparkan di peta dengan gambar. Pemandu diberi amaran bila menghampiri kawasan yang kerap berlaku kemalangan ("titik hitam"). Idea ini datang dari senarai kemalangan di Simpang Taman Seri Dagang yang dikongsi di Facebook.

- **Di peta:** lencana merah ⚠ dengan bilangan kemalangan. Rekod dalam lingkungan 150 m dikira sebagai satu lokasi.
- **Tekan lencana:** senarai kemalangan, yang terbaru dahulu. Setiap rekod tunjuk tarikh, siang/malam, kenderaan (cth. Motosikal & Kereta), keadaan mangsa, nota, dan gambar yang diluluskan.
- **Undi:** pengguna lain boleh tekan "Betul" atau "Tak betul". Rekod yang mendapat ≥5 undi "Tak betul" (dan lebih 2× undi "Betul") disorok.
- **Tambah rekod:**
  - Dari kad tempat (cari tempat atau tekan lama di peta), tekan **"Rekod kemalangan di sini"**, atau dari lencana tekan **"Tambah rekod kemalangan di sini"**.
  - Boleh rekod kemalangan **lama, sehingga 2 tahun lepas**.
  - Had 10 rekod sehari bagi setiap pengguna.
- **Laporan live:** laporan "Kemalangan" yang disahkan oleh pemandu lain menjadi rekod secara automatik.
- **Gambar:**
  - Pilihan. Pengguna perlu akui bahawa gambar tidak menunjukkan mangsa, muka atau nombor plat yang jelas.
  - Gambar dikecilkan (1280 px) dan GPS/EXIF dibuang dalam telefon sebelum dimuat naik.
  - Disimpan dalam bucket **peribadi**, dan **hanya dipaparkan selepas admin lulus** (Admin → Gambar kemalangan).
- **Amaran navigasi:** lokasi dengan **≥2 kemalangan** dalam lingkungan 80 m dari laluan dipaparkan sebagai banner merah dalam 1 km. Pada 500 m, telefon bergetar dan suara berkata: *"Awas, kawasan kerap kemalangan di hadapan. 6 kemalangan direkodkan. Pandu berhati-hati."*

**Had:**
- Rekod datang daripada pengguna, bukan data rasmi PDRM/JKR.
- Data dimuat untuk kawasan ~40 km di sekeliling peta.

**Kod:**
- Migrasi: `supabase/migrations/20261111000000_accident_records.sql` (jadual, undi, trigger dari laporan live, `review_accident_photo`, bucket `accident-photos` dan polisinya).
- `web/src/services/accidentService.ts`, `web/src/contexts/AccidentsContext.tsx`.
- `web/src/utils/accidentHotspots.ts`: pengelompokan, titik hitam di laluan, ayat amaran. Ujian: `accidentHotspots.test.ts`.
- `web/src/components/accidents/`: penanda peta, senarai rekod, borang tambah, banner amaran, semakan gambar admin.
- `web/src/hooks/useAccidentAlerts.ts`.

---

## Simpan laluan, ikut semula, balik ikut jalan sama

**Apa:** jalan yang anda lalui boleh diguna semula. Ini diminta oleh pengguna di Threads: *"boleh ke kita save map yang kita dah lalu, bila balik semula kita just buka map tu"*.

- **Ikut laluan ini:** navigasi ke destinasi yang sama melalui **jalan yang sama** seperti perjalanan dulu. Ini berbeza dengan "Go again", yang mengira laluan baru dan mungkin ikut jalan lain.
- **Balik jalan sama:** laluan yang sama tetapi arah terbalik, kembali ke titik mula perjalanan itu.
- **Simpan laluan:** beri nama (cth. "Rumah → Kampung") dan laluan itu disimpan dalam **Simpanan → Laluan**, dengan butang Ikut laluan, Balik jalan sama, Tukar nama dan Padam. Maksimum 30 laluan.

**Cara guna:** Simpanan → Perjalanan → buka satu perjalanan → bahagian "Laluan yang anda lalui".

**Bagaimana ia berfungsi:**
- Jejak GPS perjalanan (yang memang disimpan dalam telefon) diambil sampel kepada ≤18 titik.
- Titik-titik itu dihantar sebagai titik laluan (*via*) kepada router, supaya laluan baru ikut jalan yang sama.
- Banner "Ikut laluan …" dipaparkan dan boleh dibuang.

**Had:**
- Sejarah hanya menyimpan jejak untuk 10 perjalanan terakhir. Simpan laluan yang penting supaya ia tidak hilang.
- Untuk laluan dengan titik via, masa perjalanan dikira tanpa trafik langsung.
- Laluan yang disimpan hanya ada dalam telefon itu, tidak diselaraskan ke akaun.

**Kod:**
- `web/src/lib/savedRoutes.ts`: simpanan dalam telefon.
- `web/src/hooks/useFollowPath.ts`: ikut laluan / balik ikut jalan sama.
- `web/src/components/trips/SavedRoutes.tsx`: senarai laluan dan butang dalam setiap perjalanan.
- `RoutingContext.followPath()`.

---

## Admin (dengan 2FA)

**Apa:** halaman `/admin` (pautan di Profil, hanya untuk akaun admin), dengan tiga tab:
- **Kandungan dilaporkan:** sorok, pulihkan atau abaikan kandungan yang di-flag, dan sekat pengguna.
- **Gambar kemalangan:** Lulus atau Tolak.
- **Maklum balas:** mesej daripada pengguna.

**Notifikasi admin:**
- Setiap tab Admin menunjukkan **nombor merah** untuk perkara yang menunggu: operator baru, listing (baru, berubah atau gambar baru), laporan pengguna, gambar kemalangan dan mesej baru.
- **Loceng** di atas halaman Admin menunjukkan jumlah.
- Di luar halaman Admin: nombor merah pada tab **Profil** di bawah, dan kad merah **"n perkara menunggu semakan"** di atas Profil yang terus membuka Admin.
- Jika JalanGo dipasang di skrin utama, nombor juga muncul pada **ikon app** (Android Chrome, iPhone iOS 16.4+), jika telefon menyokong.
- Dikemas kini setiap minit, bila app dibuka semula dan selepas setiap tindakan admin. Hanya untuk admin dengan sesi 2FA (`admin_counts()`); pengguna lain tidak nampak apa-apa.

**Tab Statistik** (tab pertama):
- **Peranti aktif:** hari ini, 7 hari dan 30 hari, jumlah peranti, berapa yang guna app yang dipasang, dan peranti baru.
- **Carta harian 30 hari:** tekan sesuatu hari untuk lihat aktif, baru, carian dan laluan pada hari itu. Ada juga paparan jadual.
- **Komuniti:** akaun, laporan, rekod kemalangan (dan gambar yang menunggu semakan), laluan komuniti, jalan pintas, konvoi, kongsi live dan perjalanan.
- **Cara kiraan:** setiap peranti ada ID rawak dalam `localStorage`, dan ia "check-in" sekali sehari melalui `ping_activity()`. Tiada akaun, IP atau lokasi disimpan. Jadual `app_activity` tidak boleh dibaca terus. `admin_stats()` hanya untuk admin yang lulus 2FA.
- **Had:** pelayar berbeza, mod peribadi atau storan yang dipadam dikira sebagai peranti baru. Kiraan peranti bermula selepas ciri ini dilancarkan.

**Siapa admin:** akaun dalam jadual `public.admins` di Supabase. Ditambah oleh pemilik projek.

**Pengesahan dua langkah (2FA):**
- Kali pertama, admin imbas kod QR dengan aplikasi pengesah (Google Authenticator, Microsoft Authenticator, Authy).
- Selepas itu, setiap kali log masuk perlu kod 6 digit.
- Ia dikuatkuasakan dalam **pangkalan data**: `public.is_admin()` hanya benar bila sesi ada `aal2`. Kata laluan yang dicuri sahaja tidak cukup untuk lulus gambar, sorok kandungan atau sekat pengguna.

**Telefon hilang:** pemilik projek boleh padam faktor 2FA akaun itu di Supabase (Authentication → Users → pengguna → MFA), kemudian admin sediakan semula.

**Kod:**
- Migrasi: `supabase/migrations/20261112000000_admin_2fa.sql` (`is_admin()` perlukan aal2, dan `admin_status()`), dan `20261113000000_admin_stats.sql` (statistik).
- `web/src/lib/activity.ts`, `web/src/components/admin/StatsPanel.tsx`.
- `web/src/services/adminAuth.ts`, `web/src/components/admin/AdminTwoFactor.tsx`, `web/src/pages/AdminPage.tsx`.

---

## Navigasi

- **Lencana lebuh raya dan nombor exit:** nombor laluan dipaparkan seperti papan tanda (E1, E2, E6 kuning; laluan persekutuan/negeri putih), bersama **"Exit 111"** bila Mapbox menyediakannya (`web/src/components/navigation/RoadShields.tsx`, `utils/roadShields.ts`).
- **Ayat lorong:** "Guna 2 lorong kiri" / "Guna lorong paling kanan" dipaparkan dalam 2 km sebelum simpang, dan disebut bersama arahan suara ("Dalam 600 meter, ikut sebelah kiri… Guna dua lorong kiri."). Dikira daripada data lorong Mapbox (`utils/laneSentence.ts`).
- **Amaran plaza tol:**
  - Plaza tol dan gantri di laluan (dari `toll_collection` Mapbox) dipaparkan sebagai banner biru dalam 2 km, dan disebut sekali pada ~1 km: *"Plaza Tol Bukit Lanjan dalam 900 meter. Guna lorong RFID. Pastikan baki mencukupi."*
  - Tip ikut **Profil → Cara bayar tol** (RFID / Kad Touch 'n Go / SmartTAG / Kad debit-kredit).
  - **Had:** lokasi lorong RFID/TnG di setiap plaza belum ada (Mapbox/OSM tiada data ini). Dirancang sebagai sumbangan komuniti kemudian.
  - Kod: `utils/tollAlerts.ts`, `hooks/useTollAlerts.ts`, `components/navigation/TollBanner.tsx`, `lib/tollPayment.ts`.

- **Laluan dan arahan belokan:** laluan Mapbox dengan trafik langsung, beberapa pilihan laluan, dan pilihan **Elak tol**.
- **Panduan suara BM/EN:** arahan dalam Bahasa Melayu atau Inggeris, dengan had laju dan nombor jalan.
- **Laluan semula automatik:** bila pemandu tersasar dari laluan, laluan baru dicari secara automatik.
- **Mod isyarat lemah:** laluan disimpan dalam telefon, dan banner luar talian dipaparkan bila internet terputus.
- **Itinerari:** beberapa hentian dalam satu perjalanan.
- **Amaran kamera laju dan AWAS:** data OSM dari Geofabrik, dikemas kini mingguan, ditambah laporan komuniti.
- **Amaran "Jangan potong" (eksperimen):** perlu dihidupkan sendiri dan diakui oleh pengguna.

## Carian

- **Carian tempat:** Mapbox Search Box. Bila hasil kurang, carian beralih ke OpenStreetMap (Photon).
- **Nama separuh atau terpisah:** "Awana Sky" dan "awana sky way" pun dijumpai (`server/src/services/mapbox.ts`).
- **Tampal link Google Maps:** link `maps.app.goo.gl/…`, `google.com/maps/…` atau koordinat "3.40, 101.78" terus menjadi destinasi (`server/src/services/mapsLink.ts`, `GET /api/geo/link`).
- **"Cari di Google Maps":** pautan biasa (bukan API) bila tempat tidak dijumpai.
- **Carian suara:** tekan 🎤 dan sebut destinasi. JalanGo cari tempat itu, buat laluan, dan membaca laluan tersebut (`web/src/components/voice/VoiceSearch.tsx`).
- **Tekan lama pada peta:** pilih titik tepat sebagai destinasi.

## Komuniti

- **Laporan jalan raya:** kemalangan, sesak, banjir, sekatan polis, dan lain-lain. Pengguna boleh undi "masih ada / dah tiada".
- **Jalan pintas komuniti:** laluan pendek (≤60 km) yang dikongsi dari sejarah perjalanan.
- **Laluan komuniti:** laluan jauh alternatif untuk elak jem, contohnya ke Kelantan melalui Gua Musang. Termasuk laluan yang masuk semula ke jalan utama di tengah perjalanan, seperti Kuala Pilah → exit Gambang (`web/src/components/communityRoutes/`).
- **Tempat disyorkan komuniti.**

## Perkongsian

- **Butang Kongsi:** WhatsApp, Facebook, Instagram, Telegram, X, Threads, SMS, Email, Salin, dan menu kongsi telefon (`web/src/components/share/ShareSheet.tsx`).
- **Kongsi JalanGo:** kad di bahagian atas Profil.
- **Kongsi lokasi live:** dengan mod Driver (kenderaan, plat, WhatsApp, hentian seterusnya).
- **Kongsi lokasi ini:** pin sekali, bukan live.
- **Pautan tempat JalanGo:** "Kongsi tempat ini" dan "Kongsi lokasi ini" menghantar pautan JalanGo (`/?tempat=lat,lng&n=nama&a=alamat`), bukan Google Maps. Penerima buka JalanGo dengan tempat itu terpilih di peta, terus boleh tekan Arah. Setiap pautan yang dikongsi membawa orang baru ke JalanGo.
- **Konvoi:** kereta dan motosikal.
- **Kad pratonton link:** tag Open Graph dan `web/public/og-image.jpg`.

## Lain-lain

- **Harga minyak mingguan:** dari data.gov.my.
- **Tempat makan dan menarik sepanjang laluan.**
- **Sejarah perjalanan:** dengan rating perjalanan.
- **Data trafik tanpa nama:** dengan persetujuan pengguna.
- **PWA:** boleh dipasang di skrin utama. Mod gelap/cerah. UI dalam BM/EN.
- **Pasang ke skrin utama:** popup "Pasang JalanGo" ikut jenis telefon dan pelayar.
  - Android Chrome: satu butang **Pasang**.
  - iPhone Safari: langkah dengan anak panah ke butang Kongsi di bawah.
  - iPhone Chrome (iOS 16.4+): anak panah ke ikon Kongsi di bar alamat (atas kanan). iOS lama: salin pautan, buka dalam Safari.
  - Dalam app lain (WhatsApp, Facebook, Threads, Instagram): Android dapat butang "Buka dalam Chrome"; iPhone dapat arahan buka dalam pelayar dan butang salin pautan.
  - Muncul sendiri selepas ~30 saat guna peta atau sejurus selepas sampai destinasi. Tak pernah semasa memandu atau bila sudah dipasang. "Nanti dulu" = tanya lagi selepas 3 hari; "Jangan tanya lagi" = berhenti terus.
  - Juga boleh dibuka dari kad di peta dan di halaman Profil.
