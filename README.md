# Wahduid — Money Management PWA

Aplikasi pencatat keuangan pribadi berbasis web (PWA) yang **mobile first**, **bisa dipakai offline**, dan **menyimpan seluruh data di perangkat pengguna**. Tidak ada server, akun, atau pelacakan: data milik pengguna sepenuhnya.

Versi saat ini: **0.4.0**

---

## Fitur

### Keuangan
- **Transaksi**: pemasukan, pengeluaran, dan transfer antar dompet; nominal cepat (+10rb, +20rb, …); kategori & dompet terakhir terpilih otomatis.
- **Multi-dompet**: Tunai, rekening bank, e-wallet, dll. dengan saldo awal; dompet yang sudah dipakai diarsipkan, bukan dihapus.
- **Kategori**: kategori bawaan + buatan sendiri (emoji & warna), bisa ditambah langsung dari form transaksi.
- **Transaksi berulang**: harian, mingguan, bulanan, tahunan (gaji, kos, langganan). Dibuat otomatis saat jatuh tempo; aturan bisa dijeda.
- **Anggaran bulanan** per kategori dengan peringatan di Beranda saat terpakai ≥ 80%.
- **Statistik & laporan**: ringkasan bulanan, grafik donut, grafik harian, rincian per kategori, ekspor CSV.

### Sosial
- **Split Bill**: bagi rata atau per item, pajak & service, pilih siapa yang membayar, tandai lunas per orang, bagikan rincian.
- **Hutang-piutang**: catatan manual + otomatis dari Split Bill, filter lunas/belum, kirim pengingat via WhatsApp.
- **Catatan**: catatan bebas dengan pin & pencarian.

### Data & keamanan
- **Backup** ke Google Drive / WhatsApp / email / Files lewat lembar Bagikan bawaan HP, dengan opsi **enkripsi kata sandi** (AES-GCM 256).
- **Restore** dengan mode **Gabungkan** (tanpa duplikat, versi terbaru menang) atau **Ganti semua**.
- **Pengingat backup** bila belum backup ≥ 7 hari.
- **Kunci PIN 6 digit**, terkunci otomatis setelah ditinggal 1 menit.

### Tampilan & aksesibilitas
- Bahasa **Indonesia / English**, mata uang **IDR / USD**.
- Tema **Terang / Gelap / Sistem**, **ukuran teks** Normal / Besar / Sangat besar.
- Bottom navigation besar berlabel, animasi halus (otomatis nonaktif bila "Kurangi Gerakan" aktif), dukungan safe area iPhone (Dynamic Island & home indicator).
- PWA: bisa di-install, berjalan offline, notifikasi versi baru, shortcut ikon aplikasi.

---

## Tech stack

| Bagian | Teknologi |
| --- | --- |
| Framework | React 19, TypeScript, Vite 8 |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react, vaul (drawer), sonner (toast) |
| Grafik | Recharts |
| Kalender | react-day-picker |
| Penyimpanan | IndexedDB via Dexie (+ `dexie-react-hooks` untuk live query) |
| PWA | vite-plugin-pwa (Workbox) |
| Routing | React Router 7 |
| Tes | Vitest + fake-indexeddb |

Semua dependensi dipasang dengan versi yang dikunci (pinned).

---

## Menjalankan proyek

Prasyarat: Node.js 22+.

```bash
npm install
npm run dev       # server pengembangan (service worker ikut aktif)
npm test          # jalankan tes otomatis
npm run build     # type-check + build produksi ke dist/
npm run preview   # jalankan hasil build secara lokal
```

Untuk mencoba di HP, aplikasi harus diakses lewat **HTTPS** (syarat PWA). Cara termudah: deploy folder `dist/` ke hosting statis seperti Vercel, Netlify, atau Cloudflare Pages. Pastikan semua rute diarahkan ke `index.html` (SPA fallback).

---

## Struktur folder

```
src/
├── main.tsx            # entry: siapkan database (migrasi) lalu render
├── App.tsx             # routing, kunci PIN, runner transaksi berulang
├── index.css           # tema (token warna shadcn), animasi, safe area
├── db/
│   ├── db.ts           # skema Dexie v4, tipe data, helper simpan/hapus
│   ├── hooks.ts        # live query: saldo, ringkasan, anggaran, hutang
│   ├── backup.ts       # export/import v4, merge, enkripsi
│   ├── legacy.ts       # konversi data format lama (ID angka)
│   ├── migrate.ts      # migrasi database lama -> baru
│   └── sync.test.ts    # tes merge, soft delete, berulang, migrasi, enkripsi
├── lib/                # i18n, format uang/tanggal, pengaturan, PIN, PWA,
│                       # transaksi berulang, split bill, animasi
├── components/         # komponen aplikasi (dialog, navigasi, input, dll.)
│   └── ui/             # komponen shadcn/ui
└── pages/              # halaman (Beranda, Transaksi, Dompet, Profil, dll.)
```

---

## Model data & penyimpanan

Database IndexedDB: `wahduid_data`. Tabel: `transactions`, `categories`, `wallets`, `budgets`, `recurring`, `splitBills`, `debts`, `notes`, `meta`.

**Prinsip efisiensi penyimpanan**
- Hanya data mentah yang disimpan. Saldo, ringkasan bulanan, dan hutang dari Split Bill **dihitung saat dibaca**, tidak disimpan ganda.
- Field opsional yang kosong tidak ditulis (IndexedDB menyimpan nama properti di setiap record).
- Index dibuat seminimal mungkin.
- Transfer disimpan sebagai satu record; transaksi berulang hanya dibuat saat jatuh tempo (tidak ada data masa depan).

**Fondasi sinkronisasi**
- Setiap record punya **ID string acak 22 karakter** (bukan auto-increment), sehingga data dari beberapa perangkat bisa digabung tanpa bentrok.
- Data bawaan memakai ID tetap: `cat:<nama>`, `wallet:cash`. Transaksi berulang: `r.<idAturan>.<urutan>`, sehingga perangkat berbeda menghasilkan ID yang sama dan tidak dobel.
- Setiap record punya `updatedAt`; saat digabung, versi terbaru yang dipakai.
- Hapus = **soft delete**: record diganti nisan `{ id, updatedAt, deletedAt }` agar penghapusan ikut tersebar saat restore. Nisan dibersihkan setelah 180 hari.

**Migrasi**
Data dari versi sebelumnya (database `wahduid`, ID angka) dipindahkan otomatis sekali saat aplikasi dibuka. Database lama baru dihapus setelah jumlah data tervalidasi.

**Format file backup**
```json
{ "app": "wahduid", "version": 4, "exportedAt": "…", "tables": { "transactions": [ … ] } }
```
Versi terenkripsi: `{ "app", "version", "encrypted": true, "kdf": { PBKDF2-SHA256, salt, iterations }, "iv", "data" }`.
File backup lama (v1–v3) tetap bisa diimpor.

---

## Keamanan & privasi

- Tidak ada data yang dikirim ke server. Satu-satunya permintaan jaringan pihak ketiga adalah font Google (di-cache untuk offline).
- **PIN** disimpan sebagai hash PBKDF2 + salt, bukan PIN aslinya. PIN adalah **kunci tampilan**, bukan enkripsi: data IndexedDB tetap bisa dibaca oleh orang yang punya akses penuh ke perangkat. PIN tidak bisa dipulihkan.
- **Backup terenkripsi** memakai AES-GCM 256 dengan kunci dari PBKDF2-SHA256 (250.000 iterasi). Kata sandi tidak bisa dipulihkan.
- Ekspor CSV dilindungi dari *formula injection* saat dibuka di spreadsheet.

**Risiko kehilangan data**: browser dapat menghapus data situs (terutama Safari iOS untuk situs yang tidak di-install dan tidak dibuka 7 hari). Mitigasi yang sudah ada: permintaan penyimpanan permanen (`navigator.storage.persist()`), ajakan install PWA, dan pengingat backup.

---

## Batasan yang diketahui

- Konflik digabung per record (bukan per field) berdasarkan jam perangkat; jam yang salah bisa membuat data lama menang.
- Kategori buatan sendiri dengan nama sama di dua perangkat tetap menjadi dua kategori setelah digabung.
- Catatan hutang hanya untuk pelacakan dan tidak mengubah saldo dompet.
- "Catat bagian saya" di Split Bill selalu memakai kategori Makanan.
- Getaran (haptic) tidak didukung Safari iOS.

---

## Rencana berikutnya

1. Backup otomatis ke **Google Drive** (`appDataFolder`) — memakai kuota Drive pengguna, data tetap milik pengguna.
2. Opsional: sinkronisasi multi-perangkat / dompet bersama (mis. Turso + login) di atas fondasi ID, `updatedAt`, dan soft delete yang sudah ada.
3. Target tabungan, insight perbandingan bulanan, template transaksi favorit.
