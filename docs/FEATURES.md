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

**Semakan lorong vs belokan (Nov 2026, maklum balas pengguna):** kadang-kadang data lorong Mapbox tak sepadan dengan belokan. Contohnya, "Belok kiri ke Jalan P. Ramlee" dari Jalan Sultan Ismail tandakan lorong **lurus** sebagai lorong yang betul. Sekarang, jika tiada satu pun lorong yang sah menghala ke arah belokan, panduan lorong tak dipaparkan langsung (jalur, 3D, ayat dan suara). Tiada panduan lebih baik daripada panduan yang salah. Lorong lurus masih dikira betul untuk belokan condong, simpang (*fork*) dan susur. Kod: `usableLanes()` dalam `web/src/utils/laneSentence.ts`.

## Panduan belokan yang mudah dilihat

Untuk pemandu yang tak sempat membaca skrin (maklum balas pengguna, Nov 2026):

- **Anak panah atas jalan:** bila belokan seterusnya tinggal kurang 600 m, anak panah putih dilukis di atas peta, terus pada laluan melalui simpang itu (35 m sebelum hingga 25 m selepas, lebih panjang di lebuh raya), seperti cat anak panah di jalan. Ia keluar di **semua jalan**, termasuk jalan kecil dan simpang taman, kerana ia dilukis daripada garisan laluan sendiri, bukan data lorong. Tiada untuk "terus lurus".
- **Arahan ringkas:** banner kini hanya memaparkan jarak, tindakan pendek ("Belok kiri", "Bulatan: keluar ke-2", "Ikut kanan", "Keluar kiri") dan nama jalan pada baris berasingan. Ayat penuh masih ada dalam senarai langkah dan suara. Baris "Kemudian" pun diringkaskan.
- **Zum dekat simpang:** di jalan biasa (bukan lebuh raya), bawah ~60 km/j, kamera zum masuk (16.5 → 17.5) dalam 150 m terakhir sebelum belokan. Selepas belokan, ia zum keluar semula. Simpang kecil yang rapat jadi lebih mudah dibezakan.

**Kod:** `web/src/components/map/ManeuverArrow.tsx`, `routeSegment()` dalam `web/src/utils/routeProgress.ts`, `web/src/utils/turnFocus.ts` (`isRealTurn`, `cameraZoom`), `shortInstruction()` dan `maneuverTarget()` dalam `web/src/utils/voiceInstructions.ts`, `web/src/components/map/NavigationCamera.tsx`. Ujian: `turnFocus.test.ts`, `routeProgress.test.ts`, `voiceInstructions.test.ts`, `laneSentence.test.ts`.

## Lampu isyarat di laluan

Maklum balas pengguna pertama (Nov 2026): tunjuk di mana ada lampu isyarat supaya pemandu tahu simpang mana untuk belok.
- **Ikon lampu isyarat** di atas peta, pada setiap lampu isyarat di laluan yang dipilih. Ia hanya keluar bila peta dizum ke paras jalan (zum 13.5 ke atas), supaya paparan keseluruhan tak sesak.
- **Banner:** bila belokan seterusnya berada di lampu isyarat, tanda kuning "🚦 Di lampu isyarat" dipaparkan bawah "Belok kiri".
- **Ayat dan suara:** "Dalam 300 meter, di lampu isyarat, belok kanan ke Jalan Ampang". Ini hanya untuk belokan biasa, bukan bulatan, susur atau simpang (*fork*).

**Sumber data:** `intersections[].traffic_signal` daripada Mapbox Directions, yang memang datang bersama laluan. **Tiada panggilan atau kos tambahan.** Lampu isyarat hanya dipaparkan di tempat yang ada data. Kalau ikon tiada, itu tak bermakna tiada lampu di situ. Satu simpang yang ada beberapa titik dalam lingkungan 25 m dikira sebagai satu lampu. Lampu dalam lingkungan 35 m dari titik belokan dikira berada di simpang itu, kerana Mapbox selalu meletakkan lampu pada nod garisan berhenti atau jalan sebelah, bukan pada titik belokan.

**Kod:** `server/src/services/directions.ts` (`signals`, `atSignal`), `web/src/components/map/TrafficSignalLayer.tsx`, `web/src/components/navigation/TrafficLightIcon.tsx`, `turnAtSignal()` dalam `web/src/utils/voiceInstructions.ts`. Ujian: `directions.test.ts`, `voiceInstructions.test.ts`.

## Butiran perjalanan (bar bawah boleh ditarik ke atas)

Seperti Waze (permintaan pemilik, Nov 2026): semasa memandu, **tarik bar bawah ke atas** (atau tekan masa / pemegang) untuk melihat seluruh perjalanan:
- **Tiba** (jam besar, hijau jade) dengan baki masa dan jarak di kanan.
- Kad laluan gaya JalanGo: destinasi, "melalui" jalan utama, cip yang sama seperti pilihan laluan (tol, lebuh raya, laporan di depan), dan jalur laluan.
- **Jalur laluan:** satu garisan dari anda ke destinasi. Kesesakan diwarnakan (oren/merah), laporan komuniti (polis, kemalangan, bahaya…) dan plaza tol diletakkan di tempatnya. Ikon yang terlalu rapat digabung dengan lencana "+n". Laporan dimuatkan dalam lingkungan ~25 km dari pemandu.
- **Singgah di laluan:** cip kategori yang sama seperti "Sepanjang laluan" (Minyak, Makan, R&R, Kedai serbaneka, Kafe, Lagi), dalam **warna pastel**: latar lembut dalam warna kategori, dengan teks yang lebih gelap supaya mudah dibaca (lebih cerah dalam mod gelap). Butang Kongsi (jade), Seluruh laluan (biru langit), Tamat (merah lembut) dan Teruskan (jade) pun pastel.
- **Kongsi** (lokasi live) dan **Seluruh laluan** (peta zum keluar menunjukkan baki laluan; tekan "Tengah" untuk kembali ke paparan memandu).
- Bila dibuka, bar bawah menjadi **Tamat** dan **Teruskan**. Untuk tutup, **tarik ke bawah** (dari pemegang, dari bar, atau dari isi sheet bila ia di paling atas), tekan pemegang (ada anak panah ↓), atau tekan Teruskan. Gerakan dikesan dengan *touch events*, supaya browser telefon tak membatalkannya bila ia menyangka jari sedang menatal.

**Kod:** `web/src/components/navigation/TripSheet.tsx`, `web/src/utils/routeStrip.ts` (`routeStrip`, `clusterMarkers`). Ujian: `routeStrip.test.ts`.

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

- **Anggaran tol pada pilihan laluan (Fasa A):** lencana **"Tol ~RM14–21"** menggantikan "Bertol" untuk kereta. Server kira jarak di jalan bertol daripada kelas jalan Mapbox (`toll` pada titik persimpangan setiap langkah → `tollMeters`); julat = jarak bertol × RM0.09–0.14/km (lebuh raya panjang ~0.09–0.11, lebuh raya bandar lebih mahal sekilometer), minimum RM1. Motosikal: lencana "Bertol" sahaja. Perbandingan kos kereta vs awam guna nilai tengah julat ini. Fasa B (jadual tol sebenar ikut plaza, bermula dengan PLUS/ELITE/LEKAS) menyusul.
- **Tol tepat (Fasa B, enjin siap, data menunggu):** `server/src/services/tolls.ts` padankan plaza tol pada laluan (nama dari Mapbox, cth. "Plaza Tol Sungai Besi" → "Plaza Tol Ayer Keroh") dengan jadual **kadar Kelas 1 rasmi** (`TOLL_TABLE`): plaza **sistem terbuka** (harga tetap setiap plaza) dan **sistem tertutup** (harga ikut pasangan plaza masuk/keluar, cth. PLUS). Jika **semua** plaza pada laluan ada harga → `route.tollFare` dan lencana **"Tol RM12.87"** (tanpa ~); jika ada plaza tanpa harga atau tanpa nama → kekal anggaran Fasa A. Jadual **kosong** sehingga kadar rasmi (LLM/PLUS) dibekalkan — kadar tidak sah tidak boleh dimasukkan (setiap jadual wajib ada `source` dan `asOf`).
- **Lencana lebuh raya dan nombor exit:** nombor laluan dipaparkan seperti papan tanda (E1, E2, E6 kuning; laluan persekutuan/negeri putih), bersama **"Exit 111"** bila Mapbox menyediakannya (`web/src/components/navigation/RoadShields.tsx`, `utils/roadShields.ts`).
- **Ayat lorong:** "Guna 2 lorong kiri" / "Guna lorong paling kanan" dipaparkan dalam 2 km sebelum simpang, dan disebut bersama arahan suara ("Dalam 600 meter, ikut sebelah kiri… Guna dua lorong kiri."). Dikira daripada data lorong Mapbox (`utils/laneSentence.ts`).
- **Amaran plaza tol:**
  - Plaza tol dan gantri di laluan (dari `toll_collection` Mapbox) dipaparkan sebagai banner biru dalam 2 km, dan disebut sekali pada ~1 km: *"Plaza Tol Bukit Lanjan dalam 900 meter. Guna lorong RFID. Pastikan baki mencukupi."*
  - Tip ikut **Profil → Cara bayar tol** (RFID / Kad Touch 'n Go / SmartTAG / Kad debit-kredit).
  - **Had:** lokasi lorong RFID/TnG di setiap plaza belum ada (Mapbox/OSM tiada data ini). Dirancang sebagai sumbangan komuniti kemudian.
  - Kod: `utils/tollAlerts.ts`, `hooks/useTollAlerts.ts`, `components/navigation/TollBanner.tsx`, `lib/tollPayment.ts`.

- **Laluan dan arahan belokan:** laluan Mapbox dengan trafik langsung, beberapa pilihan laluan, dan pilihan **Elak tol**.
- **Skrin kekal hidup semasa navigasi:** Wake Lock; jika telefon melepaskannya (panggilan, notifikasi, suara), app minta semula serta-merta, bila kembali ke app, dan setiap 15 saat. Jika ditolak (cth. Mod Kuasa Rendah), video senyap kecil dimainkan berulang (teknik NoSleep). **Di iPhone/iPad (semua pelayar iOS ialah WebKit), video senyap dimainkan juga walaupun Wake Lock diterima**, kerana iOS kadang-kadang menerima kunci tapi skrin tetap malap selepas masa Kunci Auto (aduan pemilik, iPhone 16 Pro Max); jika iOS menjeda video (cth. selepas suara arahan), ia disambung semula setiap 15 saat. Jika itu pun gagal, banner: *"Telefon tidak benarkan skrin kekal hidup… Matikan Mod Kuasa Rendah, atau Tetapan → Paparan → Kunci Auto: Jangan."* **Chrome, Firefox atau Edge di iPhone:** di pelayar ini, iOS boleh tetap mengunci skrin walaupun Wake Lock dan video kelihatan berjaya, jadi tiada amaran dipaparkan (aduan pemilik: Chrome, iPhone 16 Pro Max, skrin malap kemudian terkunci). Semasa navigasi, tip sekali dipaparkan: *"Di iPhone, Chrome tak dapat pastikan skrin kekal hidup. Buka JalanGo dalam Safari → Kongsi → Tambah ke Skrin Utama, atau set Kunci Auto: Jangan."* Tip hilang selepas pengguna menekan "Faham". Pengesanan pelayar: `isIOSOtherBrowser()` (CriOS/FxiOS/EdgiOS/OPiOS/GSA).
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
- **Kod jalan Malaysia:** carian kenal kod kawasan/jalan dalam teks (cth. "Jalan **P9C**/1", "SS **2**/24", "USJ 1"; bukan "No 12" atau "Lot 1234"). Hasil yang menyebut kod itu (nama atau alamat) diletak dahulu; jalan dari OpenStreetMap yang **tidak** menyebut kod itu dibuang (dulu "Jalan P9C/1" memberi "Jalan KLIA 1" 40 km jauh di atas). Jika jalan kecil ("Jalan P9C/1") tiada dalam peta, **jalan induk** ("Jalan P9C") dicari dan diletak paling atas supaya pengguna sampai ke kawasan yang betul.
- **Cari alamat dengan AI** (log masuk, 10 sehari, `LOCATE_DAILY_LIMIT`): butang dalam panel carian ("Cari alamat dengan AI" bila tiada hasil; "Cari dengan AI" di bawah hasil). Server `POST /api/assistant/locate`: **Claude Sonnet 5.5** dengan **carian web Anthropic** (`web_search_20260209`, ≤3 carian, **domain Google disekat**: google.com, google.com.my, goo.gl, g.page, g.co), kemudian `search_place` (carian JalanGo sendiri) dan `report_location`. **Tiada anggaran** (permintaan pemilik: pin yang salah menghantar pemandu ke tempat salah): pin + butang Arah **hanya jika tepat** (hasil carian kita ialah alamat/premis itu sendiri). Jika tidak, hanya **kawasan** dalam teks ("Kawasan: Presint 9, Putrajaya · Lokasi tepat tak dapat dipastikan, jadi JalanGo tak meneka") dengan cadangan minta lokasi WhatsApp/Google Maps (tampal pautan) atau tanda sendiri. AI tak boleh reka koordinat; pautan sumber web dipaparkan.
- **Cadangan tempat** (jadual `place_suggestions`, admin lulus): selepas carian AI, "Betul, cadangkan untuk carian ini" (jenis **redirect**: teks sahaja, carian itu → teks carian mercu tanda; tiada data Mapbox disimpan) atau "Tanda lokasi tepat di peta" (jenis **pin**: pengguna gerakkan pin sendiri dalam pemilih lokasi; jika bermula dari mercu tanda AI, pin **mesti dialihkan** dulu). Had 20 cadangan sehari. Admin → Carian → "Cadangan tempat": Lulus (pin → Tempat JalanGo dengan kata kunci carian itu; redirect → carian dipin) atau Tolak; carian gagal yang sama ditanda selesai.
- **Pengesahan komuniti (Fasa 1):** cadangan pin dihantar melalui RPC `submit_place_suggestion`: (1) **semakan automatik** — nama jalan (jalan/lorong/persiaran…) mesti dipin **di atas jalan** yang dilukis peta (semakan dalam pemilih lokasi, peta vektor sahaja), teks sama dalam 300 m yang masih menunggu/diluluskan ditolak ("sudah dicadangkan"); (2) **"Ditanda di lokasi"** — jika lokasi GPS penghantar (ketepatan ≤100 m) dalam 150 m dari pin, cadangan ditanda `at_location` (lokasi tidak disimpan; insert terus tak boleh menipu tanda ini); (3) **"Betul ini …?"** — kad di peta (log masuk, bukan semasa navigasi) untuk pin yang menunggu dalam 1 km (bukan milik sendiri, belum diundi, tidak dipertikai); undi Betul/Salah hanya diterima dari dalam **300 m** pin, satu undi seorang (`place_suggestion_votes`); **lulus automatik** bila 📍 + 2 Betul, atau 3 Betul, tanpa Salah → terus jadi Tempat JalanGo; **2 Salah = dipertikai** (tak ditanya lagi, tunggu admin). "Tak pasti" = langkau (diingat dalam peranti). Admin nampak 📍, ✓/✗ dan dipertikai.
- **Carian pintar (AI):** bila carian tiada hasil, app tunggu ~0.9 s selepas berhenti menaip, kemudian minta server cuba lagi dengan `ai=1`: model kecil **Claude Haiku 5.5** (effort rendah, output berstruktur) tulis semula teks (ejaan, singkatan jln/tmn/kg/sek/sa/pj/ktm, buang "dekat/kat/area") kepada ≤3 carian, dan server cari setiap satu di Mapbox/OSM sehingga ada hasil. Paparan: "Tiada padanan tepat. Mencuba carian pintar…" kemudian "Tiada hasil untuk “sek7 sa”. Carian pintar menunjukkan hasil untuk **“Seksyen 7 Shah Alam”**". AI hanya menulis semula teks: **tempat sentiasa dari carian biasa, bukan dari AI**. Hanya teks dihantar (tiada lokasi/akaun). Cache 24 jam (2000 carian), had 400 panggilan sejam, timeout 4 s, tiada cuba semula; gagal = hasil kosong macam biasa. Carian yang dibetulkan AI tetap dikira dalam Admin → Carian dengan nota "AI: …" supaya boleh dijadikan sinonim. Mati jika `ANTHROPIC_API_KEY` tiada di Netlify.
- **Pembantu perjalanan (AI):** dalam panel carian, "✨ Rancang perjalanan dengan AI" (dan "Tanya pembantu AI" bila carian tiada hasil). Tanya dalam BM/English, cth. "Esok 7 pagi ke KLIA, paling murah?". Server (`/api/assistant`) guna **Claude Sonnet 5.5** (effort rendah, fallback pelayan bila model enggan) dengan alat JalanGo sendiri: `search_place` (carian kita + carian pintar), `plan_public_transport` (perancang RAPTOR: KTM/ETS, LRT/MRT, Monorel, BRT, KLIA Ekspres/Transit, bas; boleh masa bertolak kemudian), `drive_estimate` (Mapbox trafik + minyak RON95 semasa + anggaran tol; parking tidak termasuk), `taxi_estimate` (Grab kasar). AI wajib guna alat untuk setiap masa/harga/tempat; jawapan pendek (~120 patah), syor jelas. Tempat yang disebut dalam jawapan dapat butang **"Arah ke …"** (rancang laluan terus, termasuk tab Awam). **Log masuk wajib**, **20 soalan sehari** setiap akaun (`ASSISTANT_DAILY_LIMIT`, kaunter `hit_rate_limit` dengan kunci HMAC), 6 permintaan seminit setiap IP. Perbualan tidak disimpan di server (app hantar ≤8 mesej terkini); lokasi dibundarkan ~100 m. Maks 6 pusingan alat / ~20 s. Tiada semasa navigasi. Mati jika `ANTHROPIC_API_KEY` tiada.
- **Soalan dalam kotak carian:** bila teks yang ditaip nampak seperti soalan (ada "?", atau ≥4 perkataan dengan kata seperti nak/cara/paling/best/murah/berapa/bila/how/cheapest; `utils/questionLike.ts`), baris **"✨ Tanya pembantu AI: “…”"** muncul paling atas hasil carian; tekan → pembantu dibuka dan soalan terus dihantar (selepas log masuk). Pembantu tiada data ulasan/rating: untuk "paling best/sedap" ia beritahu dengan jujur, tanya kawasan/jenis atau nama, dan tawarkan rancang perjalanan ke situ.
  - **"Tak jumpa?"** dalam hasil carian (butang **Laporkan**): pengguna tulis apa yang dicari, keterangan, dan boleh tampal pautan Google Maps (lokasi dibaca dari pautan, boleh terus ke sana).
  - **Admin → Carian:** carian yang dilaporkan, tiada hasil, atau tiada yang ditekan, paling banyak dahulu (nombor merah bila dilaporkan atau tiada hasil ≥ 3 kali). Betulkan tanpa kod: **Pin hasil yang betul** (cari semula, pilih; hanya nama dan teks carian disimpan, tempat dicari semula setiap kali kerana hasil Mapbox tidak boleh disimpan), **Tambah tempat** (pautan Google Maps yang ada koordinat / "lat, lng"; hanya nama, alamat, koordinat disimpan), **Sinonim** (satu perkataan → 1–3 gantian), **Dah okey**, **Abai**. Senarai pembetulan aktif boleh dimatikan.
  - Tempat JalanGo keluar paling atas dengan tanda **Disahkan**. Peraturan dimuat semula setiap 5 minit.
  - Privasi: hanya teks carian dan kiraan, tanpa akaun, IP atau lokasi; dipadam 90 hari selepas kali terakhir dicari.
- **Laporan jalan raya:** kemalangan, sesak, **Polis** (speed trap / peronda), **Sekatan jalan (SJR)**, jalan ditutup, bahaya, banjir, kenderaan rosak, kerja jalan dan kamera AWAS. Polis dan SJR luput selepas 2 jam (kecuali disahkan semula), dan diumumkan dengan suara bila di laluan hadapan. Pengguna boleh undi "masih ada / dah tiada".
  - **Kemas kini live (Supabase Realtime)** hanya dilanggan bila peta ada di skrin, iaitu dalam tab app (Peta, Teroka, Laporan, Simpan, Profil…). Halaman tanpa peta (`/home`, `/privacy`, `/terms`, `/admin`, `/live/…`) tidak membuka saluran laporan. Bila kembali ke peta, kawasan dimuat semula supaya laporan yang berubah semasa di halaman lain tidak terlepas (Realtime-1, `ReportsContext.tsx`). Langganan bergantung pada **shell peta** (`mapShell`, diset oleh `MapView` bila di-mount), bukan pada gaya Mapbox berjaya dimuat. Jadi jika Mapbox gagal, laporan live dan amaran di laluan masih berfungsi (Realtime-1.1).
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

## Balasan maklum balas dalam app

Permintaan pemilik (Nov 2026), selepas maklum balas pengguna pertama: admin boleh membalas mesej "Hantar maklum balas", dan pengirim membacanya terus dalam JalanGo.
- **Admin → Mesej:** setiap mesej ada kotak "Send reply". Balasan boleh disunting, dan status "seen" atau "not seen yet" dipaparkan. Mesej yang dibalas ditandakan selesai, dan setiap balasan direkodkan dalam `admin_actions`.
- **Pengguna:** kad "JalanGo membalas maklum balas anda" dipaparkan pada skrin peta (tak dipaparkan semasa memandu atau semasa perjalanan tren/bas). Tekan kad itu untuk lihat mesej asal dan balasan, kemudian "Terima kasih" untuk tandakan sudah dibaca. App menyemak semula bila dibuka kembali, paling kerap sekali setiap 10 minit.
- **Tanpa log masuk pun boleh:** semasa menghantar maklum balas, telefon membuat satu kod rawak (`jalango:feedback-code`). Server hanya menyimpan SHA-256 kod itu (`device_token_hash`). Balasan dipaparkan pada telefon yang sama.
- **Had:** mesej yang dihantar sebelum ciri ini wujud, tanpa akaun, tak boleh dibalas dalam app. Balas melalui maklumat hubungan yang ditinggalkan pengirim.

**Pangkalan data:** migrasi `20261129000000_feedback_replies.sql` (tambahan sahaja): lajur `reply`, `replied_at`, `replied_by`, `reply_seen_at`, `device_token_hash`; fungsi `admin_reply_feedback` (admin sahaja), `my_feedback_replies` dan `mark_feedback_reply_seen` (hanya untuk mesej sendiri, sama ada mengikut akaun atau kod peranti).

**Kod:** `web/src/components/feedback/FeedbackReplyCard.tsx`, `web/src/services/feedbackReplyService.ts`, `FeedbackReplyBox` dalam `web/src/pages/AdminPage.tsx`, `server/src/routes/account.ts` (`replyToken`).

## Kedai serbaneka sepanjang laluan

Permintaan pemilik (Nov 2026): kategori baharu **Kedai serbaneka** (KK Mart, 99 Speedmart, 7-Eleven, CU, emart24, FamilyMart, myNEWS dan lain-lain) dalam senarai "Sepanjang laluan" dan dalam cip "Singgah di laluan" pada sheet perjalanan. Kedai dalam lingkungan 1.5 km dari laluan dipaparkan, dengan pin hijau teal di peta dan butang **Singgah**.
- **Sumber:** kategori Mapbox `convenience_store`. Semakan carian live menunjukkan KK Mart, 99 Speedmart, 7-Eleven, CU Mart, emart24, FamilyMart dan myNEWS dikategorikan "convenience store" dalam Mapbox. Jika kategori itu tiada hasil, carian teks "convenience store" digunakan.
- **Had:** sesetengah cawangan dikategorikan lain dalam Mapbox (contohnya "grocery"), jadi mungkin tak semua cawangan muncul.

## Warna laluan ke tempat singgah

Permintaan pemilik (Nov 2026): bila pengguna menambah tempat singgah dalam perjalanan (contohnya "Singgah: Surau R&R Seremban"), **garisan ungu baharu dilukis di atas garisan biru**, dari kedudukan sekarang hingga tempat singgah. Ungu ialah warna banner "Singgah". Garisan biru kekal penuh hingga ke destinasi.
- Garisan ungu lebih nipis daripada laluan, supaya tepi biru kelihatan di kiri dan kanannya. Warna kesesakan (oren/merah) juga masih kelihatan di tepi itu.
- Sebaik pemandu sampai di tempat singgah, atau menekan "Batal", garisan ungu hilang.
- Tempat singgah diletakkan pada laluan dengan unjuran ke garisan laluan (dalam lingkungan 150 m), kerana laluan memang melaluinya sebagai titik *via*.

**Kod:** `routeFeatures()` dan `STOP_VIOLET` dalam `web/src/components/map/RouteLayer.tsx`. Ujian: `RouteLayer.test.ts`.

## Chat konvoi

Permintaan pemilik (Nov 2026): ahli konvoi boleh berbual sesama sendiri.
- **Butang chat** (ikon mesej ungu dengan bilangan mesej belum dibaca) di sebelah pil "Konvoi · N kereta". Butang ini ada di skrin peta dan semasa navigasi.
- **Mesej pantas, selamat semasa memandu:** 👍 OK, ⛽ Singgah minyak, 🍽️ Singgah makan, 🚻 Singgah R&R, 🐢 Perlahan sikit, ✋ Tunggu saya, ⚠️ Ada bahaya, 🏁 Dah sampai. Butang minyak, makan, R&R dan bahaya turut menghantar **kedudukan pengirim**. Kedudukan ini dipaparkan sebagai pin emoji (dalam warna ahli) di peta semua ahli selama 1 jam, dan sebagai "Lihat di peta" dalam chat.
- **Taip mesej** hanya bila kenderaan berhenti (bawah ~11 km/j), atau bila pengguna menekan "Saya penumpang". Semasa bergerak, chat hanya menunjukkan butang pantas.
- **Mesej masuk:** banner pendek ("Ali: ⚠️ Ada bahaya") selama 9 saat, getaran, dan **dibaca dengan suara** jika suara dihidupkan. Mesej pantas dibaca dalam bahasa pendengar.
- **Privasi dan kawalan:** hanya ahli konvoi yang masih dalam konvoi boleh membaca dan menghantar. Ahli yang keluar atau dibuang, akaun yang disekat dan orang luar ditolak. Had mesej ialah 300 aksara, 8 mesej seminit dan 300 sehari bagi setiap orang. **Mesej dipadam bila ketua menamatkan konvoi.** Konvoi yang luput (12 jam) terus disembunyikan, dan mesejnya disapu pada penghantaran seterusnya, kerana tiada penjadual.
- **Masa nyata:** Supabase Realtime, dengan semakan setiap 20 saat sebagai sandaran.

**Pangkalan data:** migrasi `20261130000000_convoy_chat.sql` (tambahan sahaja): jadual `convoy_messages` (RLS: ahli konvoi aktif sahaja), fungsi `send_convoy_message`, dan trigger `convoys_after_end` yang memadam chat bila konvoi ditamatkan.

**Kod:** `web/src/contexts/ConvoyChatContext.tsx`, `web/src/services/convoyChatService.ts`, `web/src/components/convoy/ConvoyChatSheet.tsx`, `ConvoyMessagePins.tsx`, `ConvoyBanner.tsx`, `web/src/utils/convoyChat.ts`. Ujian: `convoyChat.test.ts`.

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

## Laman utama awam (/home) dan SEO asas (Fasa 1, Sprint 2A)

Keputusan pemilik (Nov 2026): laman utama pemasaran di **`/home`**. **`/` kekal sebagai peta dan navigasi**, supaya app yang dipasang (`start_url: "/"`), pautan tempat `/?tempat=…` dan jemputan konvoi `/convoy/KOD` tidak terjejas.

- **Laman utama** untuk dua kumpulan pembaca, pengguna dan pemilik bisnes (BM/EN, ikut tetapan bahasa app):
  - **Hero** dengan butang "Buka peta" (`/`) dan "Daftar bisnes" (`/business`).
  - **Di jalan raya:** panduan suara BM, laporan komuniti, elak jem, minyak/tol/R&R, konvoi, pengangkutan awam.
  - **Cari tempat:** Hotel & homestay (`/sewa?jenis=homestay`), Tempat menarik (`/explore`), Makan (`/sewa?jenis=food`), Kereta sewa & pengangkutan (`/sewa?jenis=car_rental`), dan pintu masuk "Sewa & Makan" (`/sewa`).
  - **Untuk pemilik bisnes:** faedah dan 4 langkah pendaftaran. Butang membawa ke **pendaftaran sedia ada** (`/business`); tiada sistem pendaftaran baharu. Kategori sekarang dinyatakan dengan jujur: homestay, kereta sewa, makan. Hotel, tarikan dan aktiviti "sedang dirancang".
  - **Tentang JalanGo:** pengetahuan tempatan, komuniti, privasi.
  - **Sokong JalanGo:** ruang letak sahaja ("Pilihan sumbangan akan datang"), dengan butang Kongsi JalanGo dan Maklum balas. **Tiada bayaran.**
- **Profil** ada pautan "Tentang JalanGo" ke `/home`. Tiada pautan baharu dalam peta atau semasa navigasi.
- **Satu alamat laman (`VITE_SITE_URL`):** digunakan untuk pautan kongsi, URL canonical, `og:url`/`og:image` dalam `index.html`, `robots.txt`, `sitemap.xml` dan teks "Buka … di telefon". Server menggunakan `SITE_URL` (atau `VITE_SITE_URL`). Lalai: `https://jalango.netlify.app`. Untuk pindah ke domain baharu, tetapkan satu pemboleh ubah itu.
- **SEO:**
  - `robots.txt` dan `sitemap.xml` dijana semasa build daripada satu senarai (`web/src/lib/sitePaths.ts`). Sitemap: `/home`, `/`, `/sewa`, `/explore`, `/privacy`, `/terms`. Robots menyekat `/admin`, `/api/`, `/live/`, `/business/listings/`, `/profile` dan `/saved`.
  - **Tajuk dan deskripsi** untuk setiap halaman utama (`usePageMeta`), dan **URL canonical** untuk halaman awam.
  - Halaman peribadi (`/profile`, `/saved`, `/admin`, lokasi live, sunting listing, 404) diberi `noindex`.
  - **Had:** ini SPA, jadi meta ditetapkan dalam pelayar. Google membacanya, tetapi pratonton WhatsApp/Facebook masih menggunakan kad lalai dalam `index.html`. Pratonton per halaman dirancang untuk sprint kemudian.
- **Service worker:** shell luar talian kini hanya dikemas kini oleh respons HTML. Membuka `/robots.txt` atau `/sitemap.xml` dalam app tak lagi menimpa shell itu.

**Kod:** `web/src/pages/HomePage.tsx`, `web/src/hooks/usePageMeta.ts`, `web/src/lib/site.ts`, `web/src/lib/sitePaths.ts`, plugin `siteFiles` dalam `web/vite.config.ts`, `config.siteUrl` dalam `server/src/config.ts`. Ujian: `web/src/lib/site.test.ts`.

## Penjejakan pertumbuhan (Fasa 1, Sprint 3)

Diluluskan pemilik selepas Laporan Impak Migrasi (Nov 2026). Matlamatnya: tahu **dari mana pengguna datang**, **saluran mana membawa pengguna sebenar**, dan **saluran mana menghasilkan pendaftaran bisnes**. Ini bukan kiraan page view.

- **Sumber kedatangan pertama:**
  - Direkod **sekali** bagi setiap peranti baharu, menggunakan ID rawak yang sama seperti kiraan aktif harian (`jalango:device-id`): tiada akaun, IP atau lokasi.
  - Urutan pengelasan (`web/src/utils/attribution.ts`): tag UTM, kemudian ID klik iklan (`gclid`/`ttclid`/`fbclid`, dibaca untuk tentukan saluran, **tak disimpan**), kemudian domain laman perujuk. Jika tiada isyarat, ia dikira "direct".
  - Yang disimpan: saluran (senarai tetap), medium, kempen, domain perujuk dan halaman pertama.
  - Peranti yang sudah wujud sebelum ciri ini **tidak** direkod, kerana lawatan pertama mereka tidak diketahui.
- **Pautan kongsi JalanGo** kini membawa `utm_source=<platform>&utm_medium=share`. Tanpa ini, WhatsApp tidak dapat dikesan kerana ia tidak menghantar perujuk.
- **Penukaran (conversion):**
  - **Daftar akaun** dan **daftar bisnes** dikira sekali bagi setiap akaun, hanya jika akaun atau bisnes itu dicipta dalam 24 jam terakhir.
  - Ia dikreditkan kepada saluran peranti yang mendaftar.
  - Yang disimpan hanya **jumlah harian bagi setiap saluran**. Tiada pautan antara peranti dan akaun.
- **"Pengguna sebenar":** peranti yang membuka JalanGo pada sekurang-kurangnya 2 hari berbeza dalam 14 hari pertamanya. Kadar hanya dikira untuk peranti berumur ≥14 hari.
- **Admin → Pertumbuhan** (admin sahaja, 2FA):
  - julat 7, 30 atau 90 hari;
  - untuk setiap saluran: peranti baharu, pengguna sebenar, kadar kembali, daftar akaun, daftar bisnes;
  - jadual kempen; kempen dengan <5 peranti digabung dalam "(lain-lain)";
  - tiada data individu.
- **Profil → Privasi → "Kira peranti ini dalam statistik"** (hidup secara lalai). Bila dimatikan, kiraan harian dan penjejakan pertumbuhan dihentikan untuk peranti ini.
- **Simpanan:**
  - data peranti (`device_attribution`) dan juga `app_activity` yang sedia ada: **13 bulan**;
  - jumlah harian tanpa ID (`growth_conversions`): **36 bulan**.
  - Disapu semasa peranti baharu direkod, kerana tiada penjadual.
- **Pangkalan data:** migrasi `20261201000000_growth_tracking.sql`, tambahan sahaja:
  - jadual `device_attribution`, `growth_conversions` dan `growth_counted` (dipadam bersama akaun);
  - fungsi `record_attribution` (anon, had 5,000 peranti baharu sehari), `record_conversion` (log masuk) dan `admin_growth` (admin).
  - Jadual `users` dan `operators` serta trigger mereka **tidak disentuh**.

**Pautan promosi siap guna** (tukar `kempen` ikut kempen sebenar; huruf kecil, nombor, `-` atau `_`):

| Saluran | Pautan |
|---|---|
| WhatsApp (status / kumpulan / broadcast) | `https://jalango.netlify.app/home?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=kempen` |
| TikTok (bio) | `https://jalango.netlify.app/home?utm_source=tiktok&utm_medium=bio` |
| TikTok (video / komen) | `https://jalango.netlify.app/home?utm_source=tiktok&utm_medium=social&utm_campaign=kempen` |
| Instagram (bio) | `https://jalango.netlify.app/home?utm_source=instagram&utm_medium=bio` |
| Facebook (hantaran) | `https://jalango.netlify.app/home?utm_source=facebook&utm_medium=social&utm_campaign=kempen` |
| Telegram | `https://jalango.netlify.app/home?utm_source=telegram&utm_medium=broadcast&utm_campaign=kempen` |
| Ajak bisnes mendaftar | `https://jalango.netlify.app/business?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=bisnes` |
| Iklan berbayar | `utm_medium=paid` (Google, Facebook dan TikTok juga menambah ID klik sendiri) |

**Kod:** `web/src/utils/attribution.ts` (pengelasan, `withUtm`), `web/src/lib/activity.ts` (`recordFirstVisit`, `recordConversion`, `statsOptedOut`), `web/src/services/growthService.ts`, `web/src/components/admin/GrowthPanel.tsx`. Ujian: `attribution.test.ts`, `shareLinks.test.ts`, `growthService.test.ts`, serta ujian PGlite untuk migrasi (24 semakan).

## Admin → POI (POI-2A, data ujian sahaja)

Keputusan pemilik (Nov 2026): skrin semakan dan aliran kerja POI Intelligence Engine dibina **selari** dengan POI-1. **Migrasi dan data sebenar menunggu POI-1** (liputan OSM Kuala Langat) dan **POI-2B**.

- **Tab Admin → "POI (ujian)":** admin sahaja, perlu 2FA.
- **Banner "DATA UJIAN" sentiasa dipaparkan.** Semua rekod rekaan, nama bermula "Contoh", tersebar secara rawak di sekitar Kuala Langat. **Bukan data OSM sebenar, bukan premis sebenar, dan tiada apa disimpan.** Semua tindakan hilang bila halaman dimuat semula. Butang "Set semula" mengembalikan data ujian asal.
- **Semakan:**
  - Penapis kategori (8 kategori pilot), isu dan status.
  - Rekod disusun dari kualiti paling rendah.
  - **Butiran rekod:** peta kecil dengan pin merah untuk rekod, dan pin biru untuk POI sedia ada yang mungkin pendua. Turut dipaparkan: koordinat (pautan ke osm.org), sumber, alamat, telefon dan skor kualiti.
  - **Tindakan:** Lulus (boleh tukar nama dan kategori), Tolak (dengan sebab), dan Gabung dengan pendua (POI sedia ada dikekalkan; hanya alamat atau telefon yang kosong diisi).
- **Peraturan keselamatan:** rekod tanpa nama, koordinat di luar kawasan, atau **nama generik** ("Surau", "Kedai") tidak boleh diluluskan. Nama generik perlu diganti dengan nama sebenar dahulu. Rekod yang sudah diputuskan, atau daripada larian yang sudah di-rollback, tidak boleh diputuskan semula.
- **Larian import:**
  - kiraan setiap larian: diterima, lulus automatik, diluluskan, semakan, pendua, digabung, ditolak;
  - larian "Ditahan" (contohnya akan menyembunyikan > 5% POI aktif);
  - **Rollback larian** dengan pengesahan: perubahan dikembalikan dari yang terbaru, dan rekodnya ditutup.
- **Metrik kualiti:** POI aktif, baki semakan (dan tarikh larian tertua), % lulus automatik, % ditolak, % pendua, % ada alamat atau telefon, dan pecahan setiap kategori.
- **Log audit:** lulus, tolak, gabung, tukar nama, tukar kategori dan rollback, dengan masa dan pelaku. Dalam POI-2B, log ini akan ke `admin_actions`.
- **Seni bina:**
  - Skrin bercakap dengan `poiAdminService`. Sekarang pelaksanaannya ujian dalam memori.
  - POI-2B menukarnya kepada fungsi Supabase dengan bentuk yang sama, jadi skrin tidak perlu diubah.
  - Peraturan keputusan berada dalam fungsi tulen yang diuji.
  - **Data ujian tidak digunakan untuk keputusan indeks, prestasi carian atau kapasiti pangkalan data.**

**Kod:** `web/src/utils/poiReview.ts` (peraturan, diuji dalam `poiReview.test.ts`), `web/src/services/poiAdminService.ts` (antara muka dan pelaksanaan ujian, diuji dalam `poiAdminService.test.ts`), `web/src/components/admin/poi/` (`PoiPanel`, `PoiMapPreview`, `mockPoiData`).

## Enjin POI: pangkalan data (POI-2B, migrasi sahaja)

Pemilik meluluskan reka bentuk POI-2B dan mengarahkan "migrate" (23 Nov 2026), selepas audit 50 sampel OSM sebenar Kuala Langat. Migrasi `20261202000000_poi_engine.sql` (aditif). **Belum ada import, carian awam atau paparan kepada pengguna.** Skrin Admin → POI masih menggunakan data ujian sehingga PR seterusnya.

- **Jadual:** `poi_sources` (OSM, ODbL), `poi_import_runs` (URL, MD5 dan tarikh ekstrak setiap larian), `poi_staging` (90 hari), `pois` (**data OSM sahaja**), `poi_changes` (2 tahun, untuk audit dan rollback), `poi_links` (pautan ke tempat JalanGo, tidak digabung) dan `poi_feedback` (pengesahan komuniti; UI dalam POI-3).
- **Klasifikasi petempatan** (keputusan pemilik): `city` = Bandar, `town` = Pekan, `village` = Kampung, `hamlet` = Penempatan kecil, `suburb`/`quarter`/`neighbourhood` = Bandar (taman/pinggir). Tag asal OSM disimpan dalam `osm_place_tag`.
- **Dikunci:** RLS, tiada akses terus untuk `anon`/`authenticated`. Import melalui service role sahaja (`poi_start_run`, `poi_ingest` ≤ 500 baris, `poi_process_run`). Admin dengan 2FA: `admin_poi_state`, `poi_review`, `poi_merge`, `poi_rollback_run`, `poi_release_run`.
- **Peraturan dalam pangkalan data:**
  - Lulus memerlukan nama, dan nama generik perlu ditukar dahulu.
  - Data OSM lebih 5 tahun tanpa `check_date` ditanda "perlu pengesahan" (kualiti −10).
  - Larian **ditahan** jika akan menyembunyikan > 5% atau mengubah > 20% POI aktif.
  - POI yang hilang daripada OSM disembunyikan (`missing`), bukan dipadam.
  - Rollback mengembalikan perubahan dari yang terbaru.
- **Komuniti (`poi_submit_feedback`):** satu jawapan seorang bagi setiap jenis, 30 sehari. "Masih beroperasi" atau "sudah tutup" daripada 2 orang **dalam 300 m** (tanpa jawapan bertentangan) mengemas kini status. **Lokasi tidak disimpan.** Dipadam bersama akaun. Halaman Privasi dikemas kini bila UI dilancarkan (POI-3).
- **Ujian:** PGlite, 33 semakan (akses, import, proses, tahan, rollback, semakan admin, komuniti, indeks trigram).

### Import dan Admin → POI (POI-2B-2)

- **Peraturan import** (`server/src/poi/rules.ts`, daripada audit 50 sampel): satu rekod setiap objek OSM; dalam sekolah/kolej/kem/pejabat kerajaan → **ditolak** (`institusi`), kecuali tarikan/tempat bersejarah → semakan (cth. Istana Bandar Jugra dalam kawasan sekolah); tanpa nama → ditolak sehingga bernama, **kecuali masjid/surau tanpa nama → semakan** supaya admin boleh menamakannya (keputusan pemilik 23 Nov; lulus tetap memerlukan nama); luar daerah → ditolak; nama generik, kategori meragukan ("Gallery", "Alat ganti"…) dan rawatan alternatif → **semakan**; stesen minyak tanpa nama lokasi → "jenama + `branch`" (cth. "BHPetrol Seri Cheeding"); masjid/surau hanya daripada nama (selain itu "ibadah"); data lebih 5 tahun tanpa `check_date` → diterima dengan tanda; pendua = nama + kategori sama dalam **100 m** (keputusan pemilik 25 Nov; dahulu 50 m), **kecuali** `branch` berbeza (cawangan rangkaian). Perkataan jenis tempat (klinik, farmasi, restoran…) **tidak** dibuang semasa membanding nama, jadi "U.N.I. Klinik" dan "U.n.i. Farmasi" kekal dua tempat. Petempatan ikut keputusan pemilik; tiada petempatan dalam 3 km = kosong (bukan "luar"). Diuji dengan kes sebenar audit.
- **Workflow "POI import (Kuala Langat)"** (`.github/workflows/poi-import.yml`): **manual sahaja**, **mod kering secara lalai** (tiada apa dihantar; hasil sebagai artifact 90 hari). Muat turun Geofabrik dengan MD5 dan cubaan terhad, berhenti jika sempadan rasmi Kuala Langat tiada dalam OSM. Hantar ke pangkalan data hanya bila pilihan "send" dihidupkan.
- **Endpoint `/api/poi/*`** (server): token berasingan `POI_INGEST_TOKEN` (≥ 32 aksara, bukan kunci service role), **dimatikan** kecuali `POI_IMPORT_ENABLED=true`. Wilayah dan sumber terhad (Kuala Langat, Geofabrik), setiap baris disahkan, maksimum 500 baris setiap kelompok, had kadar.
- **Admin → POI** kini membaca **data sebenar** daripada pangkalan data (`admin_poi_state`, `poi_review`, `poi_merge`, `poi_rollback_run`; admin dengan 2FA). Nota sumber "© penyumbang OpenStreetMap, ODbL" dipaparkan. Kiraan larian dan metrik dikira oleh pangkalan data. Tanpa Supabase (pembangunan tempatan) skrin kekal menggunakan data ujian berlabel.

### Pembaikan selepas import pertama (POI-2B-3)

Import pertama Kuala Langat (23 Nov 2026): 494 POI live, 22 diluluskan admin, 13 ditolak. Audit selepas semakan menemui 4 masalah, yang dibaiki di sini. Migrasi `20261203000000_poi_review_fixes.sql` (aditif: jadual baharu `poi_decisions`, dua lajur baharu pada `pois`, fungsi baharu; lima fungsi sedia ada diganti dengan tandatangan dan kebenaran yang sama).

- **Keputusan admin diingati** (`poi_decisions`, satu baris setiap objek OSM, tidak dipadam selepas 90 hari): import seterusnya membawa keputusan lulus/tolak/gabung ke larian baharu, jadi rekod yang sudah disemak **tidak masuk semula** ke barisan. Rekod hanya kembali ke barisan bila objek OSM itu berubah (versi baharu). Kiraan larian ada `carried`. Rollback larian memadam keputusan larian itu.
- **Nama generik:** "Surau" yang dibiarkan tidak berubah dalam kotak nama tidak lagi boleh diluluskan (sebelum ini kotak yang sudah terisi dianggap nama baharu). Nama baharu juga tidak boleh generik.
- **Tab "POI live"** (Admin → POI): cari POI live (nama atau `node/123`), **tukar nama/kategori** (`poi_rename`), **sembunyi** dengan sebab (`poi_set_hidden`, contohnya pendua) dan **papar semula**. Nama/kategori yang ditetapkan admin dan sembunyi oleh admin **dikekalkan** oleh import seterusnya (`admin_override`, `hidden_by_admin`); POI yang disembunyikan oleh rollback kembali bila diimport semula. Setiap tindakan direkod dalam `poi_changes` dan `admin_actions`, dan dipaparkan dalam Log audit.
- **Butang Gabung untuk pendua:** rekod pendua kini dipautkan ke POI live yang diulanginya (kategori sama dalam 100 m, nama sama diutamakan).

### Carian POI JalanGo (POI-3)

- **Carian** kini turut mencari pangkalan data POI JalanGo (data OpenStreetMap, perintis Kuala Langat) **bersama Mapbox**, tanpa pendua. Fungsi `search_pois` (migrasi `20261204000000_poi_search.sql`, aditif) hanya dipanggil oleh pelayan JalanGo (service role), hanya POI aktif (tidak termasuk tempat yang dilaporkan tutup oleh 2 orang berdekatan), maksimum 20.
- **Dua jenis carian:** nama ("Restoran K2", ejaan hampir pun dijumpai) atau **jenis + tempat** ("bengkel banting", "surau", "masjid jenjarom", "kedai makan dekat morib"); terdekat dahulu bila lokasi diketahui. Carian jenis menyenaraikan POI JalanGo dahulu; carian nama meletakkan 2 POI terbaik dahulu. Carian nama hanya menyimpan tempat yang ada perkataan khusus carian itu (contohnya "k2" dalam "restoran k2"), supaya restoran lain yang cuma serupa ejaan tidak ikut keluar; jika tiada yang sepadan (salah eja), ejaan hampir dikekalkan.
- **Selamat:** dimatikan kecuali `POI_SEARCH_ENABLED=true` (Netlify). Carian POI bermula serentak dengan Mapbox; selepas Mapbox menjawab, ia ditunggu paling lama **0.3 saat** lagi (pelayan API di AS, pangkalan data di rantau lain: 0.3–0.7 s dilihat dalam production). Jika lambat atau ralat, hasil Mapbox dipaparkan seperti biasa.
- **Atribusi:** "Sebahagian data © penyumbang OpenStreetMap" di bawah hasil carian, dan "Data © penyumbang OpenStreetMap (ODbL)" pada kad tempat. Halaman Privasi dikemas kini (25 Nov 2026).

### Semakan komuniti pada POI (POI-3b)

- **Kad tempat POI JalanGo** (hasil carian dengan id `poi:`): bahagian **"Betul ke maklumat ni?"** dengan butang **Masih beroperasi**, **Sudah tutup terus**, **Lokasi salah** dan **Cadang nama**. Log masuk sahaja; had 30 jawapan sehari; satu jawapan seorang bagi setiap jenis. Lencana "Disahkan komuniti" atau "Data lama, perlu disahkan".
- **Automatik:** "Masih beroperasi" atau "Sudah tutup terus" daripada **3 orang, sekurang-kurangnya seorang dalam 300 m** (yang lain boleh penduduk kawasan, lihat "Kawasan saya"; sejak 28 Nov, dahulu 2 orang dalam 300 m) (tanpa jawapan bertentangan) mengemas kini status. Tempat yang dilaporkan tutup **tidak lagi muncul dalam carian**.
- **Admin → POI → "Maklum balas"** (`admin_poi_feedback`, `poi_feedback_resolve`; migrasi `20261205000000_poi_feedback.sql`, aditif): jawapan dikumpul ikut tempat dan jenis, dengan bilangan orang, berapa yang berdekatan dan nama dicadangkan. **Akaun pengguna tidak dipaparkan.** Betulkan dengan tab POI live (tukar nama / sembunyi), kemudian **Terima** atau **Abaikan**.
- **Privasi:** hanya akaun dan jawapan disimpan; lokasi digunakan untuk semakan 300 m sahaja dan tidak disimpan. Halaman Privasi dikemas kini.


### Import mingguan (POI-4)

- **Jadual:** workflow "POI import (Kuala Langat)" kini ada jadual mingguan (Ahad 03:41 waktu Malaysia) yang terus menghantar ke pangkalan data, **tetapi hanya berjalan bila pembolehubah repo `POI_SCHEDULE_ENABLED` = `true`**. Tanpanya, run berjadual dilangkau. Pemilik menghidupkannya selepas 2–3 run manual yang baik. Run manual kekal seperti biasa (lalai: mod kering).
- **Hilang 2 kali berturut-turut** (migrasi `20261206000000_poi_weekly.sql`, aditif): POI live yang tiada dalam satu import **tidak lagi terus disembunyikan**; ia dikira (`missing_runs`) dan hanya ditanda `missing` bila tiada dalam 2 import berturut-turut. Bila ia muncul semula, kiraan bermula semula. Peraturan tahan (> 5% disembunyikan atau > 20% berubah) kini mengira POI yang benar-benar akan disembunyikan; kiraan run ada `absent_once`.
- **Pemantauan:** setiap run menulis ringkasan (baris, lulus automatik, semakan, ditolak, pendua, keputusan dibawa, akan disembunyikan, akan berubah) dalam *Summary* GitHub Actions. Run yang **ditahan** menjadikan workflow **gagal**, jadi GitHub menghantar notifikasi kepada pemilik; semak di Admin → POI → Larian import.
- **Kos:** import menggunakan GitHub Actions dan beberapa panggilan API (~4 setiap run), bukan deploy Netlify.

### Selangor (POI-5, pilihan B pemilik)

- **Dry-run** (workflow "POI import", pilihan wilayah `selangor`): 15,183 rekod, 13,381 lulus automatik (88%), laporan ikut daerah dan 50 sampel untuk audit (`scripts/poi/region-report.mjs`).
- **Pilihan B:** tempat Selangor masuk ke carian dengan label **"Belum disahkan"** (juga untuk Kuala Langat) sehingga pengguna berdekatan mengesahkannya. Kad tempat memaparkan lencana yang sama.
- **"Adakah … di sini?"** (kad di peta, log masuk sahaja): bila pengguna **berhenti** (bukan navigasi, kelajuan < ~11 km/j, GPS ≤ 100 m), app bertanya tentang tempat belum disahkan dalam 500 m: **Ya, ada / Sudah tiada / Lokasi salah / Tak pasti**. Menjawab perlu dalam 300 m. 2 orang berdekatan bersetuju = disahkan atau dilaporkan tutup. Tak pasti/langkau diingat dalam peranti. Lokasi tidak disimpan.
- **Import** (migrasi `20261207000000_poi_selangor.sql`, aditif): proses dalam satu pernyataan set (~13,000 baris; ~1.7 s dalam ujian), wilayah ikut larian (POI Kuala Langat menjadi milik Selangor), larian Kuala Langat ditolak selepas Selangor diimport, baris staging lulus automatik disimpan 14 hari (bukan 90) untuk jimat storan. API menerima `kuala-langat` dan `selangor` sahaja. Import Selangor sebenar menunggu "GO" pemilik.

### Pengesahan komuniti dan "Kawasan saya" (keputusan pemilik 28 Nov)

- **Siapa dikira:** jawapan **di lokasi** (dalam 300 m semasa menjawab) atau daripada **penduduk kawasan** (tempat itu dalam 1.5 km dari salah satu "Kawasan saya" pengguna). Jawapan dari tempat lain disimpan tetapi tidak dikira.
- **Peraturan:** keputusan perlukan **3 orang berbeza** memberi jawapan yang sama, **sekurang-kurangnya seorang di lokasi**, tanpa jawapan dikira yang bertentangan. Kad tempat memaparkan **"Disahkan oleh N orang"**.
- **"Kawasan saya"** (Profil): sehingga 5 kawasan (Rumah, Tempat kerja, Rumah ibu bapa, Rumah mentua, Lain-lain) dari lokasi semasa atau tempat disimpan. **Disimpan dalam telefon sahaja**; kawasan dihantar dibundarkan ~1 km semasa bertanya/menjawab dan tidak disimpan. Butang **"Bantu sahkan tempat di kawasan saya"** memaparkan soalan sekitar kawasan itu (dari mana-mana).
- **Rekod menunggu semakan** (migrasi `20261209000000_poi_queue_answers.sql`): soalan **nama** (masjid/surau tanpa nama, nama generik), **kategori** ("Adakah X sebuah klinik?") atau **orang awam boleh masuk?** (dalam institusi, admin memutuskan). Pendua tidak ditanya. 3 × nama yang sama → lulus dengan nama itu (dilindungi daripada import, "Disahkan komuniti"); 3 × kategori ya → lulus; 3 × tidak → tolak; 3 × tiada di sini → tolak. Jawapan bertentangan menunggu admin.
- **POI live:** "Masih beroperasi"/"Sudah tutup terus" ikut peraturan 3 orang yang sama (`poi_submit_feedback_v2`; fungsi lama memanggilnya).
- **Kad di peta** (bila berhenti): tempat belum disahkan dahulu, kemudian rekod menunggu semakan dalam 500 m.
- **Admin → POI → Semakan:** jawapan komuniti pada rekod (nama dan bilangan, ya/tidak, tiada; berapa di lokasi / penduduk kawasan), tanpa nama pengguna; nama paling kerap diisi dahulu.
- Had 30 jawapan sehari (semua jenis). Privasi dan Terma dikemas kini (sumbangan nama diterbitkan di bawah ODbL).

### "Sekitar sini" (fasa 1)

- **Kad di peta** bila pengguna berhenti (bukan navigasi) dan tiada soalan pengesahan berdekatan: **"Nak tahu apa ada sekitar sini?"** dengan **Tempat makan** / **Tempat menarik**. Paling kerap sekali sehari bagi setiap kawasan ~1 km; **"Jangan tanya lagi"** mematikannya (dalam telefon).
- **Senarai** (`/api/geo/around`, fungsi `places_around`, migrasi `20261210000000_places_around.sql`, pelayan sahaja): data JalanGo sahaja dalam 3 km: **cadangan komuniti** dahulu ("Disyorkan N orang"), kemudian tempat **"Disahkan N orang"**, kemudian yang terdekat. Tempat dilaporkan tutup tidak dipaparkan. Percuma (tiada panggilan Mapbox atau AI). **Tiada rating atau ulasan**, dan tiada yang direka.
- **"Tanya pembantu AI"** (log masuk): pembantu kini ada alat `places_around`, dan hanya menyebut apa yang JalanGo tahu (disyorkan / disahkan N orang); tidak menggelar tempat "sedap"/"popular" dan tidak mereka rating, harga atau waktu buka.
- **Label lebih jelas:** "Masih beroperasi" / "Sudah tutup terus" (bukan "Masih buka", yang boleh disangka "buka sekarang").

## Deploy dan versi live

- **Versi live:** setiap build menulis `/version.json` (commit dan masa build, daripada `COMMIT_REF` Netlify). Admin memaparkan "Versi app" di bawah halaman, dan pautan muat semula bila laman sudah ada versi lebih baharu.
- **Live check** (workflow GitHub, selepas setiap push ke `main`): menunggu sehingga `/version.json` menunjukkan commit itu (atau yang lebih baharu), paling lama 20 minit; gagal jika tidak, supaya pemilik diberitahu. Perubahan yang di-merge **belum dikira live** sehingga semakan ini lulus.
- **Jimat kredit Netlify:** build dilangkau bila tiada fail app berubah sejak build terakhir (hanya dokumen, migrasi, skrip import POI, workflow atau ujian). Deploy manual commit yang sama (contohnya selepas menukar pembolehubah Netlify) tetap dibina.

## Lain-lain

- **Gambar profil:** bila log masuk dengan Google/Facebook, halaman Profil memaparkan gambar profil akaun itu (dimuat terus daripada penyedia, tanpa referrer; tidak disalin oleh JalanGo). Jika tiada atau gagal dimuat, huruf pertama nama dipaparkan.

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
