# Pelan Marketplace JalanGo

**Status:** draf untuk semakan pemilik. Tiada kod lagi.
**Dikemas kini:** Fasa 1 = homestay + kereta sewa (keputusan pemilik, 13 Nov 2026).

> **Perubahan sementara (keputusan pemilik, 13 Nov 2026):** lesen APAD **tidak diwajibkan** buat masa ini. Operator tanpa lesen mesti menerima **penafian** (direkod dengan tarikh), dan masih wajib ada **SSM + insurans**. Hanya operator berlesen yang sah mendapat lencana **"Berlesen APAD"**. Pada Fasa 1, pelanggan akan dimaklumkan bila operator tiada lesen. Risiko yang dicatat semasa perbincangan: penguatkuasaan APAD/JPJ, insurans persendirian biasanya tidak meliputi sewaan, dan reputasi JalanGo. Keputusan ini patut disemak semula sebelum Fasa 1 dilancarkan.
**Kedudukan:** JalanGo ialah **pengganti Waze**, dan itu teras produk. Marketplace ialah **tambahan**. Ia tidak boleh melambatkan, mengganggu atau melemahkan navigasi.

---

## 1. Keputusan yang sudah dibuat

| Perkara | Keputusan |
|---|---|
| Kategori pertama | **Homestay / rumah sewa** dan **kereta sewa berlesen sahaja** |
| Syarat kereta sewa (asal) | Operator **wajib** ada **lesen APAD** (kereta sewa pandu sendiri) dan **insurans komersial/sewa** yang sah. Operator tanpa lesen **tidak** disenaraikan, walaupun dengan label. Ramai operator tiada lesen, tetapi insurans kereta persendirian biasanya tidak melindungi kegunaan sewa (risiko kepada pelanggan), dan JalanGo tidak boleh mempromosikan aktiviti tanpa lesen. |
| Kemudian | Rider penghantaran (makanan, barang, dokumen); hotel/chalet |
| Tidak dibuat | **Pemandu e-hailing**. Mereka perlu lesen APAD dan hanya boleh beroperasi melalui syarikat pengantara berlesen. Menghubungkan pelanggan terus kepada pemandu berisiko menjadikan JalanGo pengantara tanpa lesen. Mungkin melalui kerjasama dengan syarikat berlesen pada masa depan. |
| Siapa sahkan operator | Pemilik (admin), melalui halaman Admin dengan 2FA |
| Tempahan & bayaran | Fasa awal: **WhatsApp** sahaja. JalanGo tidak memegang wang. |
| Nama / jenama | Belum diputuskan (jomjalan.my dalam pertimbangan) |

---

## 2. Matlamat

1. **Pengguna** jumpa kereta sewa atau homestay yang **disahkan**, di lokasi yang mereka tuju, dan hubungi operator dengan satu tekan.
2. **Operator** dapat pelanggan baru, dan boleh lihat bukti nilainya: tontonan, klik WhatsApp, navigasi ke premis.
3. **JalanGo** dapat data milik sendiri (listing yang dimasukkan operator) dan pendapatan, tanpa risiko kewangan atau undang-undang yang besar pada fasa awal.

**Ukuran kejayaan Fasa 1:** 20–30 operator disahkan di 1–2 kawasan, dan ≥100 klik "Hubungi" sebulan.

---

## 3. Fasa

### Fasa 0: Asas (akaun bisnes + admin)
- Pengguna boleh **daftar sebagai operator** dengan nama perniagaan, jenis, kawasan, nombor telefon/WhatsApp, dan dokumen.
- **Dokumen pengesahan** disimpan dalam bucket peribadi. Hanya pemilik akaun dan admin boleh melihatnya.
  - **Kereta sewa (wajib semua):**
    - SSM syarikat;
    - **lesen APAD kereta sewa pandu sendiri** (atau lesen setara di Sabah/Sarawak, perlu disahkan) dengan nombor lesen dan tarikh tamat;
    - **sijil insurans** yang meliputi kegunaan sewa, dengan tarikh tamat.
  - **Homestay:** IC atau SSM pemilik + bukti pemilikan atau kebenaran pemilik (bil utiliti / perjanjian sewa) + pendaftaran PBT/MOTAC **jika** negeri itu mewajibkannya (perlu disahkan ikut negeri).
  - Sistem menyimpan **tarikh tamat lesen dan insurans**. Listing kereta sewa **dijeda automatik** bila mana-mana satu tamat, dan operator diberi peringatan 30 hari sebelum.
- **Admin → Operator:** senarai menunggu, lihat dokumen, kemudian **Lulus**, **Tolak** (dengan sebab) atau **Minta maklumat**.
- **Admin → Log tindakan:** siapa lulus atau tolak apa, dan bila.

### Fasa 1: Direktori + WhatsApp (MVP)
- Operator yang disahkan cipta **listing**:
  - kereta: model, tahun, transmisi, tempat duduk, harga sehari/mingguan, deposit, lokasi ambil, boleh hantar ke lapangan terbang atau tidak, gambar;
  - homestay: jenis (rumah/bilik/apartmen), bilik, katil, kapasiti, kemudahan (wifi, parkir, kolam, dapur, surau berdekatan), harga semalam, gambar.
- Listing dan gambar **disemak admin** sebelum disiarkan (guna semula sistem kelulusan gambar kemalangan).
- **Tab baru "Sewa"** di bar bawah, dengan dua pilihan: Kereta | Homestay.
  - Cari ikut **kawasan atau peta**, dengan penapis harga, kapasiti dan transmisi.
  - Kad listing: gambar, harga, kawasan, jarak, dan lencana **✓ Disahkan**. Kereta sewa juga ada lencana **✓ Berlesen APAD · Berinsurans**, sebagai nilai jualan: "Semua kereta sewa di JalanGo berlesen."
  - Butang: **WhatsApp** (mesej sudah diisi: listing, tarikh, lokasi), **Telefon**, **Navigasi ke sini**, **Kongsi**.
- **Pin di peta** untuk listing (lapisan boleh dihidupkan atau dimatikan, dimatikan semasa navigasi).
- **Papan pemuka operator:** tontonan, klik WhatsApp/telefon, navigasi, dan "ditandakan" mingguan.
- **Lapor listing:** palsu, harga mengelirukan, scam. Masuk ke barisan Admin → Laporan.

### Fasa 2: Integrasi navigasi + ulasan
- **"Di destinasi anda":** bila merancang perjalanan ke bandar lain (≥50 km), panel laluan menunjukkan 2–3 homestay atau kereta sewa dekat destinasi.
  - **Hanya semasa merancang**, tidak semasa memandu.
  - Contoh: navigasi ke KLIA atau Lapangan Terbang Kota Bharu, kemudian "Kereta sewa di sini".
- **Ulasan "Disahkan sampai":** hanya pengguna yang **tiba** di lokasi listing melalui navigasi JalanGo (dalam 150 m) boleh menulis ulasan. Ulasan dilabel "Sampai melalui JalanGo". Ini susah dipalsukan berbanding ulasan biasa.
- **Promosi:** operator boleh tambah tawaran (cth. "Diskaun 10% hujung minggu") dengan tarikh tamat.

### Fasa 3: Permintaan tempahan dalam app
- **Kalendar kekosongan** setiap listing (operator tanda tarikh penuh).
- Pengguna hantar **permintaan tempahan** (tarikh, bilangan orang, nota). Operator terima atau tolak dalam app. Notifikasi dihantar melalui WhatsApp/email, dan push bila ada app native.
- **Sejarah tempahan** untuk pengguna dan operator.

### Fasa 4: Bayaran + komisen (hanya bila ada permintaan sebenar)
- **Deposit dalam talian** melalui gerbang bayaran Malaysia (Billplz / ToyyibPay / Stripe), terus kepada operator jika boleh.
- Model marketplace (JalanGo terima wang, kemudian bayar operator) memerlukan semakan undang-undang dan syarat gerbang bayaran, termasuk polisi pembatalan dan bayaran balik.
- **Komisen** setiap tempahan, atau yuran langganan.

### Kemudian: Rider penghantaran
Direktori rider bebas atau runner ikut kawasan: servis, kawasan liputan, harga asas, WhatsApp. Pengesahan: IC + lesen memandu yang sesuai (GDL untuk p-hailing, perlu disahkan) + insurans.

### Kemudian: Pemandu & Transfer (airport transfer, private driver)
Dicadangkan oleh pemilik (13 Nov 2026). **Tidak dibuat dalam Fasa 1.**

**Kenapa berasingan daripada kereta sewa:** pemandu operator **membawa penumpang**. Dari segi undang-undang, ini pengangkutan penumpang berbayar, sama kategori dengan e-hailing, bukan kereta sewa pandu sendiri. Risiko keselamatan juga lebih tinggi: orang asing membawa penumpang, termasuk wanita dan pelancong, kadang-kadang lewat malam.

**Syarat (lesen penuh wajib, tiada pilihan penafian):**
- Lesen operator yang sesuai, iaitu kereta sewa berpemandu/limosin atau setara (APAD). Perlu disahkan.
- **Setiap pemandu didaftar dan disahkan:** IC, gambar wajah terkini, lesen memandu + **lesen PSV**. Pemilik semak setiap pemandu.
- Insurans yang meliputi **penumpang**.
- **Permit lapangan terbang** jika mengambil penumpang di lapangan terbang (cth. KLIA/klia2). Perlu disahkan dengan pengendali lapangan terbang.
- Tarikh tamat lesen, PSV dan insurans disimpan. Listing atau pemandu dijeda automatik bila tamat.

**Ciri yang dirancang:**
- Listing servis: airport transfer (dari/ke lapangan terbang, harga tetap ikut kawasan), private driver (harga sejam/sehari), jenis kenderaan dan bilangan penumpang.
- **"Pemandu wanita tersedia"** dan tapisan **"Pemandu wanita sahaja"**:
  - hanya untuk pemandu yang identitinya sudah disahkan (IC + gambar), supaya tiada yang menyamar;
  - jantina hanya dipaparkan sebagai tanda "Pemandu wanita", dengan persetujuan pemandu (data peribadi, PDPA).
- Hubungi melalui WhatsApp (seperti Fasa 1). Tempahan dan bayaran dalam app hanya selepas Fasa 3–4.
- Butang **Kongsi perjalanan live** (ciri sedia ada) dicadangkan kepada penumpang semasa menaiki kenderaan.

**Jadual tambahan (bila dibina):**
- `operator_drivers`: `operator_id`, nama, gambar, jantina (pilihan), no. PSV + tarikh tamat, status semakan;
- `driver_documents` (bucket peribadi, seperti dokumen operator).

---

## 4. Peraturan susunan dan "Ditaja"

**Konflik kepentingan:** pemilik JalanGo juga operator kereta sewa. Peraturan ini perlu ditulis dan dipaparkan kepada operator:

1. **Susunan biasa** dikira dengan formula yang sama untuk semua: jarak + kelengkapan listing + rating + respons. Tiada keutamaan untuk mana-mana operator, termasuk pemilik.
2. **"Ditaja"** (berbayar) boleh berada di atas, tetapi **mesti berlabel "Ditaja"**, maksimum 1–2 slot setiap senarai.
3. Listing milik pemilik JalanGo mengikut peraturan yang sama. Jika ditonjolkan, ia juga dilabel "Ditaja".

**Keselamatan pemandu (wajib):**
- Tiada listing, iklan atau "Ditaja" muncul **semasa navigasi**, atau semasa telefon bergerak >10 km/j.
- Cadangan hanya dipaparkan semasa merancang laluan, selepas tiba, atau dalam tab Sewa.

---

## 5. Model pendapatan

| Peringkat | Apa | Bila |
|---|---|---|
| Percuma | Akaun operator, 3 listing, statistik asas | Fasa 1 |
| Ditaja | Slot atas berlabel, ikut kawasan/kategori, cth. RM30–100 sebulan | Fasa 1–2 |
| Pro | Listing tanpa had, statistik penuh, promosi, lencana Pro | Fasa 2 |
| Komisen | % daripada tempahan berbayar | Fasa 4 |

Pada awalnya, bayaran Ditaja/Pro boleh diurus **secara manual** (invois + pindahan bank), dan admin menghidupkannya dalam Admin. Gerbang bayaran tidak perlu pada Fasa 1.

---

## 6. Reka bentuk teknikal (ringkas)

Ikut prinsip `docs/VISION.md`: modular monolith, Supabase + RLS, tiada servis baru.

### Jadual baru (Supabase)
| Jadual | Kandungan utama |
|---|---|
| `operators` | `user_id`, nama perniagaan, jenis (`car_rental` / `homestay` / `rider`), kawasan, telefon/WhatsApp, `status` (`pending` / `approved` / `rejected` / `suspended`), `verified_at`, sebab penolakan |
| `operator_documents` | `operator_id`, jenis dokumen, `file_path` (bucket peribadi), status semakan |
| `listings` | `operator_id`, kategori, tajuk, penerangan, harga, lokasi (lat/lng), `details` jsonb (medan khas ikut kategori), `status` (`draft` / `pending` / `live` / `rejected` / `paused`), `sponsored_until` |
| `listing_photos` | `listing_id`, `path`, `status` (semakan admin), susunan |
| `listing_events` | Kiraan harian tanpa nama ikut listing: tontonan, klik WhatsApp, klik telefon, navigasi. **Tiada identiti pengguna.** |
| `listing_reviews` (Fasa 2) | `listing_id`, `user_id`, rating 1–5, teks, `verified_arrival` |
| `booking_requests` (Fasa 3) | `listing_id`, `user_id`, tarikh, bilangan orang, nota, status |
| `admin_actions` | Log: admin, tindakan, sasaran, masa |

### Keselamatan
- **RLS:**
  - operator hanya boleh mengubah data sendiri;
  - orang awam hanya nampak listing `live` daripada operator `approved`;
  - dokumen hanya untuk pemilik dan admin.
- **Semua tindakan admin** melalui `is_admin()` (2FA wajib).
- Gambar dan dokumen dikecilkan dan EXIF dibuang di telefon sebelum dimuat naik (seperti rekod kemalangan).
- Had kadar: pendaftaran operator, listing baru, laporan.

### Skrin baru
- **Pengguna:** tab Sewa (senarai + peta + penapis), halaman listing, lapor listing.
- **Operator:** "Daftar sebagai operator", "Bisnes saya" (profil, dokumen, status), "Listing saya" (cipta/sunting/jeda), "Statistik".
- **Admin:**
  - tab **Operator** (semakan dokumen);
  - tab **Listing** (semakan listing dan gambar);
  - tab **Ditaja** (hidup/matikan, tarikh tamat);
  - Statistik ditambah: operator, listing, klik WhatsApp.

---

## 7. Undang-undang & privasi (PDPA)

- **Terma Operator** (baru): operator bertanggungjawab atas lesen, insurans, harga, keadaan kereta atau rumah, dan urusan dengan pelanggan. JalanGo hanya platform direktori pada Fasa 1–3. Larangan listing palsu atau tanpa lesen.
- **Terma Pengguna:** tambah bahagian marketplace. Kontrak sewaan ialah antara pengguna dan operator.
- **Dasar Privasi:** dokumen operator (tujuan: pengesahan sahaja, disimpan selagi akaun aktif + tempoh yang ditetapkan), statistik listing tanpa nama, dan ulasan.
- **Jangan kumpul IC atau lesen memandu pelanggan** dalam app sehingga Fasa 4, dan hanya jika benar-benar perlu.
- **Perlu disahkan dengan pihak berkuasa / peguam sebelum Fasa 1 dilancarkan:**
  1. lesen yang diperlukan untuk kereta sewa pandu sendiri (APAD, dan Sabah/Sarawak), cara menyemak nombor lesen operator, dan jenis insurans yang betul;
  2. keperluan homestay ikut negeri/PBT;
  3. sama ada mengiklankan operator berlesen memerlukan apa-apa kebenaran untuk JalanGo sendiri.

---

## 8. Strategi pelancaran

1. **Homestay dahulu:** jemput 20–30 homestay di 1–2 kawasan. Pendaftaran dan semakan pertama percuma.
2. **Kereta sewa berlesen:** cari operator yang sudah ada lesen APAD (biasanya syarikat kereta sewa yang lebih besar, termasuk di lapangan terbang). Kategori ini dibuka di app bila sudah ada sekurang-kurangnya 5 operator berlesen di kawasan pertama.
3. **Bisnes pemilik:** boleh disenaraikan selepas mendapat lesen APAD dan insurans sewa, mengikut syarat yang sama dengan operator lain.
4. Kongsi di Threads/Facebook/TikTok dengan pautan terus ke listing (kad pratonton sudah ada).
5. Selepas 1–2 bulan, semak statistik operator. Jika klik WhatsApp bermakna, perkenalkan Ditaja/Pro.

---

## 9. Jawapan pemilik (13 Nov 2026)

| Soalan | Keputusan |
|---|---|
| Kawasan pertama homestay | **Kawasan pelancongan** |
| Operator kereta sewa berlesen | Pemilik **kenal syarikat berlesen** untuk dijemput awal |
| Harga | **Percuma 6 bulan pertama** untuk setiap operator (dikira dari tarikh diluluskan). Ditaja/Pro selepas itu. |
| Dokumen homestay | **IC + bukti pemilikan/kebenaran** sahaja. PBT/MOTAC tidak diwajibkan. |
| Nama tab | **Tunggu jenama baru.** Guna nama sementara "Sewa" dalam kod. |
| Bila mula | **Fasa 0–1 dalam versi web dahulu**, mula dengan Fasa 0 |
