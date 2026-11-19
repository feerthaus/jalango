# Fungsi JalanGo

Senarai fungsi yang ada dalam JalanGo: apa ia buat, cara guna, dan di mana kodnya.
Kemas kini fail ini dalam PR yang sama setiap kali fungsi baru ditambah atau diubah (lihat `AGENTS.md`).

---

## Peta 2D / 3D

- **Butang 2D/3D** di lajur kawalan kanan peta (dan dalam paparan memandu). Butang tunjuk mod semasa; **3D** berwarna hijau. Pilihan diingat pada telefon. Lalai: **2D**.
- **2D (standard):** sama seperti sebelum ini. Melayari peta: rata, menghala utara. Memandu: kamera condong 50° mengikut arah perjalanan.
- **3D:** kamera condong **55°** dan **bangunan 3D** (zoom 14 ke atas). Bila bertukar ke 3D, arah semasa dikekalkan; semasa memandu, arah ikut perjalanan. Bertukar ke 2D: kembali rata dan menghala utara (semasa memandu: kamera memandu biasa).
- Kamera hanya bergerak **sekali** bila mod ditukar; ia tidak melawan pengguna yang memutar atau menyengetkan peta sendiri.
- **Bangunan:** dikesan semasa app berjalan ikut gaya peta. Gaya Mapbox Navigation (sekarang) → satu lapisan `fill-extrusion` daripada data bangunan Mapbox Streets, di bawah laluan dan label supaya laluan sentiasa kelihatan. Gaya berasaskan Mapbox Standard → `setConfigProperty('basemap','show3dObjects')`. Peta demo (tiada token Mapbox) → condong sahaja, tiada bangunan.
- Tiada panggilan API tambahan: bangunan datang daripada jubin peta yang sama.
- Telefon pendek (tinggi ≤ 620px, cth. iPhone SE): butang tema gelap/cerah di peta disembunyikan supaya tidak bertindih; tema masih di Profil.

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

## Marketplace: kedai makan (restoran, warung, gerai)

- **Daftar:** Bisnes saya → **Kedai makan**. Dokumen wajib: **IC** dan **gambar premis**. Pilihan: SSM, lesen PBT, sijil pengendali makanan, **sijil Halal JAKIM/JAIN**.
- **Listing kedai:** jenis (restoran, warung, gerai, kafe, food truck), waktu buka & tutup (boleh lepas tengah malam, cth. gerai malam 6 ptg–2 pg), hari cuti, servis (makan di kedai, tapau, hantar), status halal, menu ringkas (hingga 25 hidangan dengan harga), anggaran harga seorang, lokasi tepat dan hingga 12 gambar. Tiada kalendar kekosongan.
- **Halal:** "Halal JAKIM" hanya boleh dipilih dan dipaparkan selepas admin menyemak sijil (Admin → Operator → **Sahkan Halal JAKIM**; boleh ditarik balik). Tanpa sijil: "Pemilik Muslim" atau "Tiada daging babi" sahaja.
- **Untuk pengguna:**
  - **Teroka → Makan:** kedai disemak JalanGo dalam 80 km dahulu, kemudian kedai dari data peta (belum disemak).
  - **Halaman kedai (`/sewa/:id`):** "Buka sekarang / Tutup sekarang" (waktu Malaysia), waktu buka, hari cuti, servis, lencana halal, menu & harga, butang WhatsApp ("Nak tanya / tempah"), telefon dan arah.
  - **Ada laluan, sebelum mula:** panel laluan menunjukkan **"n kedai makan disemak JalanGo sepanjang laluan"** (dalam 3 km dari laluan). Tekan untuk senarai.
  - **Sepanjang laluan (Makan):** bahagian **"Kedai disemak JalanGo"** di atas, dengan jenis, buka/tutup dan harga, butang Singgah.
  - **Semasa memandu:** kedai hanya muncul jika pengguna sendiri membuka senarai "Sepanjang laluan". Tiada popup.
- Halaman `/sewa` kini **"Sewa & Makan"** dengan tapisan **Makan**.

## Marketplace Fasa 1b: Sewa (untuk pengguna)

- **Pintu masuk:** kad **"Sewa kereta & homestay"** di atas halaman Teroka, atau terus ke `/sewa`.
- **Berhampiran (Teroka):** butang **Homestay** dan **Kereta sewa**. Listing JalanGo yang disemak dalam 80 km dipaparkan dahulu (kotak "Disemak JalanGo", maksimum 5, pautan ke halaman listing). Di bawahnya, tempat dari data peta Mapbox yang **belum disemak JalanGo**. Homestay dicari ikut nama dalam ~25 km (dilebarkan ke 80 km jika kurang 3 hasil); kereta sewa ikut kategori Mapbox `car_rental`, kemudian teks "kereta sewa" jika kosong. Jika Mapbox menemui kurang 5 yang bernama, **OpenStreetMap** (Photon) melengkapkan senarai: homestay ikut tag `tourism=guest_house/chalet/apartment/hostel`, kereta sewa ikut `amenity=car_rental`, dalam 80 km, terdekat dahulu (data OSM di luar bandar masih sedikit). Label "© penyumbang OpenStreetMap". Jika satu sumber gagal, sumber lain tetap dipaparkan. **Google Places tidak digunakan** (17 Nov 2026): syarat Google melarang data Places dipaparkan atas peta bukan Google (peta JalanGo ialah Mapbox).
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
- Di luar halaman Admin: nombor merah pada tab **Profil** di bawah, dan **kad Admin** di Profil (di atas "Kongsi JalanGo"): aktif hari ini (+baru), aktif 7 hari (berapa dipasang), jumlah akaun, dan butang setiap barisan semakan (Operator, Listing, Laporan, Gambar, Mesej) dengan nombornya. Tekan butang untuk terus ke tab itu (`/admin?tab=...`). Tanpa sesi 2FA, kad hanya meminta pengesahan 2FA.
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
- **Skrin kekal hidup semasa navigasi:** Wake Lock; jika telefon melepaskannya (panggilan, notifikasi, suara), app minta semula serta-merta, bila kembali ke app, dan setiap 15 saat. Jika ditolak (cth. Mod Kuasa Rendah), video senyap kecil dimainkan berulang (teknik NoSleep). Jika itu pun gagal, banner: *"Telefon tidak benarkan skrin kekal hidup… Matikan Mod Kuasa Rendah, atau Tetapan → Paparan → Kunci Auto: Jangan."*
- **Panduan suara BM/EN:** arahan dalam Bahasa Melayu atau Inggeris, dengan had laju dan nombor jalan.
- **Bahasa paparan ikut tetapan BM/EN:** semua teks skrin (butang, label, mesej ralat, label kemudahan/jenis/hari) bertukar bila bahasa ditukar ke English. Ujian `i18n.guard.test.ts` gagalkan CI jika ada teks baru tanpa `t()`. Sedia untuk Thai, Indonesia dan Filipino (`Msg` terima `th`/`id`/`fil`, jatuh ke English jika tiada).
- **Butang "Tengah" (navigasi):** bulat, di atas bulatan laju kenderaan, muncul bila peta dialih dari kereta.
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

## Musim banjir: laporan banjir + amaran cuaca
- **Laporan banjir "boleh lalu?":** bila lapor **Banjir**, wajib pilih **"Boleh lalu, perlahan"** atau **"Tak boleh lalu"** (lajur `traffic_reports.flood_passable`, hanya untuk banjir; laporan lama = tidak dinyatakan). Tajuk di mana-mana (amaran di laluan, suara, kad laporan, senarai laporan): "Banjir · tak boleh lalu" / "Banjir · boleh lalu perlahan". Tamat sendiri selepas 12 jam (sedia ada), pengesahan "masih ada / dah surut" seperti laporan lain.
- **Laluan elak banjir:** semasa mengira laluan memandu (termasuk reroute), app ambil laporan banjir **tak boleh lalu** yang aktif dalam kotak perjalanan (+15 km), buang yang dalam 300 m dari titik mula/destinasi, ambil ≤10 yang paling dekat dengan perjalanan (`utils/floodAvoid.ts`, ≤1.5 s, gagal = laluan biasa), dan server minta Mapbox `exclude=point(lng lat)` (bersama `toll` jika Elak tol). Jika tiada laluan lain, server kira semula tanpa titik itu (`avoided: 0`). Panel laluan: "🌊 Laluan mengelak N kawasan banjir yang dilaporkan tak boleh lalu."
- **Amaran cuaca MetMalaysia:** `GET /api/weather/warnings` (data.gov.my `weather/warning`, cache 10 min) — hanya amaran darat (ribut petir, hujan lebat/berterusan, cuaca buruk); amaran laut dan "Tiada Nasihat" dibuang; negeri dikesan dari teks BM/EN. App kenal pasti negeri anda tanpa rangkaian (bandar terdekat daripada ~120 bandar, `utils/malaysiaState.ts`) dan papar banner kuning di peta (negeri anda) dan di panel laluan (negeri anda + destinasi): "Amaran Ribut Petir · Selangor · sehingga 1:00 PTG · MetMalaysia"; tekan untuk teks penuh (daerah), X untuk sorok amaran itu. Tiada lokasi dihantar untuk ini.
- Suapan paras air sungai JPS di data.gov.my (`flood-warning`) **lapuk sejak Feb 2024**, jadi belum diguna; boleh ditambah bila JPS/data.gov.my hidupkan semula.

## Komuniti

- **Carian yang belajar:** hasil yang namanya ada semua perkataan ditaip keluar dulu; sinonim tempatan terbina (ktm → stesen ktmb, lrt/mrt → stesen, hosp → hospital, rnr → r&r, masjid → mosque) dicuba bila hasil teratas tak padan, kemudian OpenStreetMap.
- **Carian pintar (AI):** bila carian tiada hasil, app tunggu ~0.9 s selepas berhenti menaip, kemudian minta server cuba lagi dengan `ai=1`: model kecil **Claude Haiku 5.5** (effort rendah, output berstruktur) tulis semula teks (ejaan, singkatan jln/tmn/kg/sek/sa/pj/ktm, buang "dekat/kat/area") kepada ≤3 carian, dan server cari setiap satu di Mapbox/OSM sehingga ada hasil. Paparan: "Tiada padanan tepat. Mencuba carian pintar…" kemudian "Tiada hasil untuk “sek7 sa”. Carian pintar menunjukkan hasil untuk **“Seksyen 7 Shah Alam”**". AI hanya menulis semula teks: **tempat sentiasa dari carian biasa, bukan dari AI**. Hanya teks dihantar (tiada lokasi/akaun). Cache 24 jam (2000 carian), had 400 panggilan sejam, timeout 4 s, tiada cuba semula; gagal = hasil kosong macam biasa. Carian yang dibetulkan AI tetap dikira dalam Admin → Carian dengan nota "AI: …" supaya boleh dijadikan sinonim. Mati jika `ANTHROPIC_API_KEY` tiada di Netlify.
- **Pembantu perjalanan (AI):** dalam panel carian, "✨ Rancang perjalanan dengan AI" (dan "Tanya pembantu AI" bila carian tiada hasil). Tanya dalam BM/English, cth. "Esok 7 pagi ke KLIA, paling murah?". Server (`/api/assistant`) guna **Claude Sonnet 5.5** (effort rendah, fallback pelayan bila model enggan) dengan alat JalanGo sendiri: `search_place` (carian kita + carian pintar), `plan_public_transport` (perancang RAPTOR: KTM/ETS, LRT/MRT, Monorel, BRT, KLIA Ekspres/Transit, bas; boleh masa bertolak kemudian), `drive_estimate` (Mapbox trafik + minyak RON95 semasa + anggaran tol; parking tidak termasuk), `taxi_estimate` (Grab kasar). AI wajib guna alat untuk setiap masa/harga/tempat; jawapan pendek (~120 patah), syor jelas. Tempat yang disebut dalam jawapan dapat butang **"Arah ke …"** (rancang laluan terus, termasuk tab Awam). **Log masuk wajib**, **20 soalan sehari** setiap akaun (`ASSISTANT_DAILY_LIMIT`, kaunter `hit_rate_limit` dengan kunci HMAC), 6 permintaan seminit setiap IP. Perbualan tidak disimpan di server (app hantar ≤8 mesej terkini); lokasi dibundarkan ~100 m. Maks 6 pusingan alat / ~20 s. Tiada semasa navigasi. Mati jika `ANTHROPIC_API_KEY` tiada.
- **Soalan dalam kotak carian:** bila teks yang ditaip nampak seperti soalan (ada "?", atau ≥4 perkataan dengan kata seperti nak/cara/paling/best/murah/berapa/bila/how/cheapest; `utils/questionLike.ts`), baris **"✨ Tanya pembantu AI: “…”"** muncul paling atas hasil carian; tekan → pembantu dibuka dan soalan terus dihantar (selepas log masuk). Pembantu tiada data ulasan/rating: untuk "paling best/sedap" ia beritahu dengan jujur, tanya kawasan/jenis atau nama, dan tawarkan rancang perjalanan ke situ.
  - **"Tak jumpa?"** dalam hasil carian (butang **Laporkan**): pengguna tulis apa yang dicari, keterangan, dan boleh tampal pautan Google Maps (lokasi dibaca dari pautan, boleh terus ke sana).
  - **Admin → Carian:** carian yang dilaporkan, tiada hasil, atau tiada yang ditekan, paling banyak dahulu (nombor merah bila dilaporkan atau tiada hasil ≥ 3 kali). Betulkan tanpa kod: **Pin hasil yang betul** (cari semula, pilih; hanya nama dan teks carian disimpan, tempat dicari semula setiap kali kerana hasil Mapbox tidak boleh disimpan), **Tambah tempat** (pautan Google Maps yang ada koordinat / "lat, lng"; hanya nama, alamat, koordinat disimpan), **Sinonim** (satu perkataan → 1–3 gantian), **Dah okey**, **Abai**. Senarai pembetulan aktif boleh dimatikan.
  - Tempat JalanGo keluar paling atas dengan tanda **Disahkan**. Peraturan dimuat semula setiap 5 minit.
  - Privasi: hanya teks carian dan kiraan, tanpa akaun, IP atau lokasi; dipadam 90 hari selepas kali terakhir dicari.
- **Laporan jalan raya:** kemalangan, sesak, **Polis** (speed trap / peronda), **Sekatan jalan (SJR)**, jalan ditutup, bahaya, banjir, kenderaan rosak, kerja jalan dan kamera AWAS. Polis dan SJR luput selepas 2 jam (kecuali disahkan semula), dan diumumkan dengan suara bila di laluan hadapan. Pengguna boleh undi "masih ada / dah tiada".
- **Jalan pintas komuniti:** laluan pendek (≤60 km) yang dikongsi dari sejarah perjalanan.
- **Laluan komuniti:** laluan jauh alternatif untuk elak jem, contohnya ke Kelantan melalui Gua Musang. Termasuk laluan yang masuk semula ke jalan utama di tengah perjalanan, seperti Kuala Pilah → exit Gambang (`web/src/components/communityRoutes/`).
- **Tempat disyorkan komuniti.**

## Bas (Fasa 2b)

- **Bas dalam tab Awam:** Rapid KL (bas bandar), bas pengantara MRT (T-xxx), **Rapid Penang** dan **myBAS Johor Bahru**, digabung dengan tren/LRT/MRT. Perancang boleh guna bas sebagai batu pertama/terakhir ke stesen (cth. Kota Damansara: bas 780 → MRT → LRT ke KLCC) atau bas sahaja (Komtar → Batu Ferringhi: bas 101; JB Sentral → Skudai: bas J31).
- **Data harian:** fungsi berjadual Netlify `transit-build` (2:00 pagi waktu Malaysia) muat turun 6 jadual GTFS dari data.gov.my, bina rangkaian dan simpan **snapshot ringkas** (~0.7 MB gzip, dari ~50 MB) dalam Supabase Storage (bucket peribadi `transit`). API muat snapshot dalam ~0.2 s. Jika snapshot tiada atau > 36 jam, API guna tren + LRT/MRT sahaja (dimuat terus).
- **Paparan:** lencana "Bas 780", "Bas T117" (warna laluan atau hijau gelap), nota "bayar dalam bas (tunai atau kad, ikut operator)", tambang anggaran.
- Nama perhentian dibersihkan daripada kod ("KL1117 LRT Bangsar" → "LRT Bangsar"; "SS15 …" kekal).
- Rapid Kuantan tiada di data.gov.my (404).

## Pengangkutan awam: LRT, MRT, Monorel, BRT + KTMB (Fasa 2a)

- **Tab Memandu | Awam** dalam panel laluan untuk destinasi ≥ 2 km (dahulu "Tren", ≥ 30 km).
- **Rangkaian:** jadual rasmi GTFS dari data.gov.my: KTMB (ETS, Intercity, Komuter, Shuttle) + **Rapid KL rel** (LRT Ampang, Sri Petaling, Kelana Jaya, Shah Alam; MRT Kajang, Putrajaya; Monorel; BRT Sunway). Jadual "setiap X minit" (frequencies) dikembangkan ke setiap perjalanan. Dimuat dan disimpan 6 jam di server; jika satu sumber gagal, yang lain tetap berfungsi.
- **Perancang (RAPTOR):** sehingga 4 kenderaan (3 kali tukar). **Tukar laluan dengan berjalan kaki** antara stesen dalam 450 m (cth. KL Sentral KTM ↔ LRT ↔ Monorel, Pasar Seni LRT ↔ MRT), sekurang-kurangnya 2 minit. Ke stesen: jalan kaki jika ada stesen dalam 1.2 km; jika tiada, Grab/teksi ke 6 stesen terdekat. ETS/Intercity: 10 minit di platform. Pilihan: yang paling awal sampai, yang kurang tukar, dan tren utama seterusnya (bukan sekadar LRT lain ke ETS yang sama), keluar selewat mungkin (tiada tunggu sejam di stesen), + yang paling murah.
- **Tambang anggaran:** Rapid KL rel dikira **sekali** merentas laluan (ikut jarak); ETS/Intercity/Komuter ikut jarak. Dilabel anggaran.
- **Paparan:** lencana warna laluan (LRT KJL, MRT PYL, ETS…), langkah demi langkah termasuk "Jalan kaki ke … untuk tukar laluan", "tap kad Touch 'n Go atau kad bank" untuk Rapid/Komuter, butang tiket KTMB/12Go hanya untuk ETS/Intercity. Peta melukis setiap laluan ikut warna dan jalan kaki bertukar sebagai garis putus-putus.
- **API:** `GET /api/transit/plan?from=&to=` (lama `/api/transit/train` kekal).
- Belum: bas Rapid KL, bas pengantara MRT, Rapid Penang, myBAS JB (Fasa 2b; data besar). Rapid Kuantan tiada di data.gov.my.

## Tren antara bandar (Fasa 1)

- **Tab Memandu | Tren** dalam panel laluan, untuk destinasi ≥ 30 km (garis lurus).
- **Jadual rasmi KTMB** (GTFS dari data.gov.my, dikemas kini setiap hari): ETS (JB Sentral–Padang Besar), Intercity (Shuttle Timur, Ekspres Rakyat Timuran), Komuter dan Shuttle Tebrau. Server muat jadual dan simpan 6 jam (`/api/transit/train`).
- **Pilihan tren:** stesen dalam 40 km dari lokasi dan destinasi, tren terus atau 1 tukar (masa tukar ≥ 10 min, tunggu ≤ 4 jam), dalam 24 jam akan datang: 3 yang paling awal sampai + 1 yang paling murah (jika lebih murah). Setiap pilihan: masa keluar rumah (perjalanan ke stesen + 10 min di platform), Grab/teksi atau jalan kaki ke/dari stesen (anggaran masa dan kos), stesen, masa, jarak dan anggaran tambang.
- **Perbandingan kos sehala (anggaran):** kereta = minyak (RON95 BUDI95 semasa, 7 L/100 km; motosikal 3 L/100 km) + tol (~RM0.10/km jika laluan bertol; motosikal RM0) + **parking** di destinasi (jadual kadar harian pusat bandar, percuma di luar) × bilangan hari. Tren = tambang × bilangan orang + Grab/teksi ke/dari stesen (dikongsi). Pilihan **Orang** (1–4) dan **Hari di sana** (1, 2, 3, 5). Mesej: "Naik tren jimat sekurang-kurangnya RMx", "Kos lebih kurang sama" atau "memandu lebih murah".
- **Tambang ialah anggaran** (data terbuka tiada tambang; KTMB guna Tambang Fleksi). Dilabel jelas di skrin.
- **Beli tiket (Pilihan A):** butang "Beli tiket di KTMB" ke laman rasmi KTMB (online.ktmb.com.my) untuk ETS/Intercity/Shuttle. Komuter: tap kad Touch 'n Go. **Pilihan B:** butang kedua **"Beli melalui 12Go"** (pautan affiliate ke halaman laluan 12Go, cth. kuala-lumpur → ipoh; stesen lain ke halaman KTM 12Go) muncul bila `VITE_TWELVEGO_ID` diset di Netlify, dengan notis "rakan JalanGo, kami mungkin dapat komisen; harga mungkin berbeza dari KTMB". Butang KTMB rasmi sentiasa ada. Terma (BM/EN) menyebut pautan affiliate.
- **Ke stesen:** jika pilihan itu jalan kaki ke stesen, butang **"Jalan kaki ke stesen"** kira **laluan pejalan kaki** (Mapbox walking: lorong, lintasan dan jejantas; tiada tol, trafik atau arah kenderaan; anggaran demo 4.5 km/j). Mod jalan kaki tanpa "Elak tol", tab Awam, jalan pintas pemandu atau data trafik tanpa nama, dan kongsi lokasi tidak lapor "jem" kerana berjalan perlahan. Jika perlu Grab/teksi, butang "Arah ke stesen" kira laluan memandu.
- **KLIA Ekspres & KLIA Transit (ERL):** ERL tiada GTFS terbuka, jadi jadual dibina dalam kod (`server/src/services/transit/erl.ts`) ikut corak perkhidmatan ERL: Transit KL Sentral → BTS 7 min → Putrajaya & Cyberjaya 19 → Salak Tinggi 28 → KLIA T1 35 → KLIA T2 39 (arah balik T2 → KL Sentral 39); Ekspres KL Sentral → T1 28 → T2 31 tanpa henti. Kekerapan: hari bekerja 06:00–09:00 & 16:00–22:00 setiap 15 min, selain itu Ekspres 20 min / Transit 30 min; hujung minggu Ekspres 20 / Transit 30. Ekspres 05:00–23:00, Transit 05:00–00:00 (anggaran, bukan jadual rasmi; nota di bawah pilihan). Tambang ikut jadual ERL mengikut pasangan stesen (cth. KL Sentral–Salak Tinggi RM18.30, KL Sentral–KLIA RM55); **mulai 1 Jan 2027 jadual baharu** (RM21.60, RM65…); pasangan yang tiada dalam jadual semasa dianggar (julat). T1↔T2 RM2. Bayar dengan tap kad Touch 'n Go/kad bank. Bersambung dengan LRT/MRT/KTM di KL Sentral, BTS dan Putrajaya Sentral (jalan kaki ≤450 m). Kemas kini `erl.ts` bila ERL ubah jadual atau tambang.
- **Ikut perjalanan (Mula):** butang **"Mula ikut perjalanan"** pada pilihan Awam. Panel di bawah peta tunjuk langkah semasa (jalan kaki ke stesen → naik → tukar → jalan kaki ke destinasi), "N hentian lagi ke X", masa tiba, dan senarai langkah (tekan mana-mana langkah untuk betulkan). Kedudukan ikut **GPS** bila tepat (≤150 m, dalam 400 m dari landasan; ikon satelit hijau) dan ikut **jadual** bila tiada isyarat (terowong). Naik tren lebih awal/lewat: lompat ke laluan yang betul bila GPS tunjuk. **Amaran turun:** bunyi + getar (20 saat, butang OK) **satu stesen sebelum** turun: "Turun di stesen seterusnya: X · tukar ke … / ini perhentian terakhir"; tanpa GPS, satu hentian (1–4 min) sebelum waktu tiba. Tiada amaran untuk stesen yang sudah lepas. Skrin kekal hidup. Perjalanan disimpan dalam peranti (diteruskan selepas muat semula; tamat dengan X, auto padam beberapa jam selepas tiba); tiada data dihantar. Peta lukis laluan tren itu.
- **Di peta:** pilihan tren yang dibuka (atau yang pertama) dilukis: setiap tren ikut warna laluannya (ETS kuning, Komuter merah/biru…), garis putus-putus untuk Grab/jalan kaki ke dan dari stesen, dan bulatan stesen dengan nama. Laluan kereta disorok semasa tab Tren dibuka, dan peta dizum ke perjalanan itu.
- **Laju:** pilihan tren diminta sebaik laluan jauh dirancang (sebelum tab Tren ditekan) dan diingat 3 minit di telefon dan di server. Pengiraan di server dioptimumkan (kira-kira 20–70 ms selepas jadual dimuat).
- Belum: LRT/MRT/bas (Fasa 2), masa tren secara langsung.

## Perkongsian

- **Butang Kongsi:** WhatsApp, Facebook, Instagram, Telegram, X, Threads, SMS, Email, Salin, dan menu kongsi telefon (`web/src/components/share/ShareSheet.tsx`).
- **Kongsi JalanGo:** kad di bahagian atas Profil.
- **Kongsi lokasi live:** dengan mod Driver (kenderaan, plat, WhatsApp, hentian seterusnya).
- **Amaran "Dah sampai" untuk yang menunggu (halaman `/live/...`):** butang **"Beritahu saya bila sampai"**. Tekan sekali (pelayar perlukan satu tekanan untuk benarkan bunyi): bunyi dibuka dan skrin dikekalkan hidup (Wake Lock).
  - **Sampai** bila kereta ≤ 150 m dari sasaran, atau bila perkongsian "sehingga sampai" tamat dengan kedudukan terakhir ≤ 300 m (navigasi pemandu tamat di destinasi).
  - **Sasaran:** destinasi pemandu (lalai), atau **"Beritahu bila dekat dengan saya"**: lokasi orang yang menunggu, hanya dalam telefonnya (tidak dihantar).
  - **Bila sampai:** bip berulang (3 nada) setiap 2.5 s hingga 30 s + getar (Android; iPhone tak sokong getar web) + banner hijau "… dah sampai!" + tajuk tab "🟢 … dah sampai!". Butang **Hentikan bunyi**; banner yang ditutup tidak muncul lagi.
  - Tanpa menekan butang: banner tetap muncul, tanpa bunyi. Pautan yang sudah tamat sebelum dibuka tidak dikira "sampai".
  - Had: tiada bunyi bila telefon dikunci atau halaman ditutup (notifikasi push = Fasa 2, KIV).
- **Status trafik untuk yang menunggu (halaman `/live/...`):**
  - **Kesesakan:** bila pemandu (sedang navigasi) bergerak bawah 15 km/j lebih 2 minit, dan bukan dalam 600 m dari destinasi, penerima nampak banner kuning *"… dalam kesesakan lalu lintas sejak 3:12 ptg · mungkin lewat ~X min"* dan tajuk tab *"🟡 … dalam kesesakan"*. Hilang selepas 30 saat atas 25 km/j (tak berkelip di lampu isyarat).
  - **Anggaran sampai yang jujur:** *"Anggaran sampai 3:45 ptg (~25 min lagi)"* + label *"lewat ~X min"* (≥ 3 min) berbanding anggaran di awal perjalanan. App pemandu semak semula trafik (laluan Mapbox dengan trafik) setiap 5 minit semasa berkongsi; anggaran tidak pernah lebih awal daripada baki laluan.
  - **Bunyi:** jika penerima tekan "Beritahu saya bila sampai", satu bunyi pendek + getar bila status bertukar ke kesesakan. Hanya bila halaman terbuka (notifikasi push = Fasa 2).
  - Data: `slow_since`, `eta_delay_s` dalam perkongsian; dipadam bila perkongsian dihentikan (`get_live_share_v3`).
- **Kongsi lokasi ini:** pin sekali, bukan live.
- **Pautan tempat JalanGo:** "Kongsi tempat ini" dan "Kongsi lokasi ini" menghantar pautan JalanGo (`/?tempat=lat,lng&n=nama&a=alamat`), bukan Google Maps. Penerima buka JalanGo dengan tempat itu terpilih di peta, terus boleh tekan Arah. Setiap pautan yang dikongsi membawa orang baru ke JalanGo.
- **Konvoi:** kereta dan motosikal.
- **Kad pratonton link:** tag Open Graph dan `web/public/og-image.jpg`.

## Lain-lain

- **Harga minyak mingguan:** dari data.gov.my.
- **Tempat makan dan menarik sepanjang laluan.** Tab: Makan, Kafe, **Penginapan** (hotel dari kategori Mapbox + homestay ikut nama dalam ~8 km setiap titik; homestay disemak JalanGo di atas), Menarik, R&R, Minyak, EV.
  - **Nama pada pin:** 10 tempat terdekat di depan, serta kedai/homestay disemak JalanGo (tanda ✓) dan cadangan komuniti (⭐), supaya peta tidak sesak semasa memandu. Kedai makan disemak JalanGo tunjuk **Buka/Tutup** terus pada label.
  - **Tekan pin:** kad tunjuk nama, alamat dan jarak. Rating dan status buka/tutup Google **tidak dipaparkan** (syarat Google: tidak boleh bersama peta bukan Google). Butang **Review** membuka Google Maps sendiri. Gerai yang disemak JalanGo tunjuk status buka/tutup dari waktu operasi mereka.
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
