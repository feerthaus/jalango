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

## Navigasi

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
- **Konvoi:** kereta dan motosikal.
- **Kad pratonton link:** tag Open Graph dan `web/public/og-image.jpg`.

## Lain-lain

- **Harga minyak mingguan:** dari data.gov.my.
- **Tempat makan dan menarik sepanjang laluan.**
- **Sejarah perjalanan:** dengan rating perjalanan.
- **Data trafik tanpa nama:** dengan persetujuan pengguna.
- **PWA:** boleh dipasang di skrin utama. Mod gelap/cerah. UI dalam BM/EN.
