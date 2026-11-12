# Pelan Marketplace JalanGo

**Status:** draf untuk semakan pemilik. Tiada kod lagi.
**Kedudukan:** JalanGo ialah **pengganti Waze**, dan itu teras produk. Marketplace ialah **tambahan**. Ia tidak boleh melambatkan, mengganggu atau melemahkan navigasi.

---

## 1. Keputusan yang sudah dibuat

| Perkara | Keputusan |
|---|---|
| Kategori pertama | **Kereta sewa** dan **homestay / rumah sewa** |
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
  - Kereta sewa: SSM + **lesen kereta sewa pandu sendiri** (APAD di Semenanjung; badan berkaitan di Sabah/Sarawak, perlu disahkan).
  - Homestay: SSM atau IC pemilik + bukti pendaftaran/lesen PBT atau MOTAC jika ada (keperluan berbeza ikut negeri, perlu disahkan).
- **Admin → Operator:** senarai menunggu, lihat dokumen, kemudian **Lulus**, **Tolak** (dengan sebab) atau **Minta maklumat**.
- **Admin → Log tindakan:** siapa lulus atau tolak apa, dan bila.

### Fasa 1: Direktori + WhatsApp (MVP)
- Operator yang disahkan cipta **listing**:
  - kereta: model, tahun, transmisi, tempat duduk, harga sehari/mingguan, deposit, lokasi ambil, boleh hantar ke lapangan terbang atau tidak, gambar;
  - homestay: jenis (rumah/bilik/apartmen), bilik, katil, kapasiti, kemudahan (wifi, parkir, kolam, dapur, surau berdekatan), harga semalam, gambar.
- Listing dan gambar **disemak admin** sebelum disiarkan (guna semula sistem kelulusan gambar kemalangan).
- **Tab baru "Sewa"** di bar bawah, dengan dua pilihan: Kereta | Homestay.
  - Cari ikut **kawasan atau peta**, dengan penapis harga, kapasiti dan transmisi.
  - Kad listing: gambar, harga, kawasan, lencana **✓ Disahkan**, dan jarak.
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
  1. lesen yang diperlukan untuk kereta sewa pandu sendiri (APAD, dan Sabah/Sarawak);
  2. keperluan homestay ikut negeri/PBT;
  3. sama ada mengiklankan operator berlesen memerlukan apa-apa kebenaran untuk JalanGo sendiri.

---

## 8. Strategi pelancaran

1. **Mula dengan bisnes kereta sewa pemilik** sebagai operator pertama, untuk menguji aliran dari hujung ke hujung.
2. **Jemput 20–30 operator** di 1–2 kawasan (kawasan pemilik + satu kawasan pelancongan atau lapangan terbang). Pendaftaran dan semakan pertama percuma.
3. Kongsi di Threads/Facebook/TikTok dengan pautan terus ke listing (kad pratonton sudah ada).
4. Selepas 1–2 bulan, semak statistik operator. Jika klik WhatsApp bermakna, perkenalkan Ditaja/Pro.

---

## 9. Soalan terbuka (perlu jawapan pemilik)

1. **Kawasan pertama:** di mana bisnes kereta sewa anda, dan kawasan kedua mana yang paling mudah untuk dapat operator?
2. **Homestay atau kereta sewa dulu,** jika perlu pilih satu untuk Fasa 1?
3. **Harga Ditaja/Pro:** setuju dengan julat RM30–100 sebulan, atau percuma sepenuhnya untuk 3–6 bulan pertama?
4. **Dokumen wajib:** cukup SSM + lesen, atau perlu salinan insurans kenderaan juga?
5. **Nama tab:** "Sewa", "Jom Sewa", atau ikut jenama baru?
6. **Bila mula:** selepas app native Android (supaya notifikasi operator berfungsi), atau terus Fasa 0–1 dalam versi web?
