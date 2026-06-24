# Backend – Redaksi (CMS per Tenant)
> Stack: CI4, PHP 8.4+, Twig 3, MySQL
> Path: `backend/pages/redaksi/`
> Semua modul bekerja dalam scope `organisasi_id` (per tenant)

## Konvensi Publish — Berlaku di Semua Modul Konten
> Setiap form tambah/edit konten punya **2 tombol aksi**:
> - **Simpan Draft** — simpan ke DB, status = `draft`, tidak tampil di publik
> - **Publish** — simpan ke DB, status = `published`, trigger push snapshot ke Go Edge
>
> Konten berstatus `draft` tidak di-push ke Go Edge.
> Konten yang sudah `published` bisa ditarik kembali ke `draft` (unpublish) — Go Edge hapus snapshot.
> Tidak ada status `review` atau `archived` untuk saat ini.

---

## Berita
- [~] `Berita.php` controller — list, tambah, edit, hapus
- [~] `ValBerita.php` model validasi
- [ ] Views: list berita (datatable), form tambah/edit
- [ ] Status: `draft` / `published` — 2 tombol di form (Simpan Draft | Publish)
- [ ] Fitur: thumbnail upload, excerpt, body (rich text/HTML)
- [ ] Relasi ke `cms_kategori`
- [ ] Slug auto-generate dari judul
- [ ] SEO meta per artikel (title, description, og:image)
- [ ] Tombol Unpublish di list — ubah status kembali ke draft + hapus snapshot Go Edge

## Kategori
- [~] `Kategori.php` controller
- [~] `ValKategori.php`
- [ ] Views: list kategori, form tambah/edit
- [ ] Parent/child kategori (nested, 2 level cukup)

## Halaman (Static Pages)
- [~] `Halaman.php` controller
- [~] `ValHalaman.php`
- [ ] Views: list halaman, form tambah/edit
- [ ] Status: `draft` / `published` — 2 tombol (Simpan Draft | Publish)
- [ ] Slug custom (user isi sendiri, validasi unique per tenant)
- [ ] Body: rich text/HTML editor
- [ ] Tombol Unpublish

## Galeri
- [~] `Galeri.php` controller — album foto
- [~] `ValGaleri.php`
- [ ] Views: list album, manajemen foto per album
- [ ] Status album: `draft` / `published` — 2 tombol
- [ ] Upload multiple foto ke album
- [ ] Caption per foto
- [ ] Urutan foto (manual sort)
- [ ] Tombol Unpublish album

## Pengumuman
- [~] `Pengumuman.php` controller
- [~] `ValPengumuman.php`
- [ ] Views: list pengumuman, form tambah/edit
- [ ] Status: `draft` / `published` — 2 tombol
- [ ] Tanggal mulai & berakhir (auto-hide dari publik jika expired, tapi tetap di DB)
- [ ] Tombol Unpublish

## Slider / Banner
- [~] `Slider.php` controller
- [~] `ValSlider.php`
- [ ] Views: list slider, form tambah/edit, preview urutan
- [ ] Upload gambar slider
- [ ] Urutan drag-and-drop (atau input angka urutan)
- [ ] Link tujuan (opsional)
- [ ] Aktif/nonaktif per item (bukan draft/publish — slider tidak punya body konten)

## Menu
> Visual menu builder dengan dukungan dropdown. Library JS dibuat sendiri (tidak pakai library eksternal).

### Struktur Data Menu (JSON di DB)
```json
[
  { "id": 1, "label": "Beranda", "url": "/", "target": "_self", "children": [] },
  { "id": 2, "label": "Profil", "url": "#", "target": "_self", "children": [
      { "id": 3, "label": "Sejarah", "url": "/halaman/sejarah", "target": "_self", "children": [] },
      { "id": 4, "label": "Visi Misi", "url": "/halaman/visi-misi", "target": "_self", "children": [] }
  ]},
  { "id": 5, "label": "Berita", "url": "/berita", "target": "_self", "children": [] }
]
```

### CI4 Backend
- [~] `Menu.php` controller
- [~] `ValMenu.php`
- [ ] Simpan struktur menu sebagai JSON di tabel `cms_menu` kolom `struktur`
- [ ] Endpoint `POST redaksi/menu/simpan` — terima JSON struktur, validasi, simpan ke DB
- [ ] Endpoint `POST redaksi/menu/publish` — push `menu.json` ke Go Edge + trigger render ulang
- [ ] Views: halaman menu builder (load JS library custom)

### JS Library Custom — Menu Builder
> Dibuat sendiri, disimpan di `public/assets/js/menu-builder.js`
> Tidak pakai SortableJS, Nestable, atau library drag-drop eksternal lain.

- [ ] Render pohon menu dari JSON yang ada di DB
- [ ] Tambah item menu baru (label, URL, target: `_self` / `_blank`)
- [ ] Edit item yang sudah ada (klik item → form inline muncul)
- [ ] Hapus item (dengan konfirmasi jika punya children)
- [ ] Drag-and-drop untuk atur urutan item (antar sibling)
- [ ] Drag item ke dalam item lain → jadi dropdown child
- [ ] Drag item keluar dari parent → naik jadi item root
- [ ] Support dropdown tidak terbatas level (nested bebas)
- [ ] Serialisasi state tree → JSON → kirim ke endpoint simpan CI4
- [ ] Preview live: render HTML menu di bawah builder sesuai struktur saat ini

## SEO
- [~] `Seo.php` controller — meta tag per halaman
- [ ] Model untuk SEO (ValSeo.php)
- [ ] Views: list halaman + meta, form edit meta
- [ ] Field: title, description, keywords, og:image
- [ ] Robots.txt management

## Media (File Manager)
> File fisik tersimpan di **Go Edge** (server frontend).
> CI4 hanya simpan **metadata** di DB + handle upload lalu forward ke Go Edge.
> File diakses publik via Go Edge. CI4 baca URL dari DB untuk ditampilkan di panel.

### Struktur Folder di Go Edge
```
runtime/public/tenants/{domain}/media/
└── {nama-folder}/           ← dibuat admin tenant
    └── {tahun}/             ← otomatis dari tanggal upload
        └── {bulan}/         ← otomatis dari tanggal upload
            ├── foto-gedung.jpg
            ├── laporan-tahunan.pdf
            └── ...
```
Contoh: `runtime/public/tenants/acehprov.go.id/media/berita/2025/05/foto-gedung.jpg`

### Alur Upload
```
Admin tenant
    │  1. Buat folder dulu (nama bebas: "berita", "galeri", "dokumen")
    │  2. Pilih folder, upload file
    ▼
CI4 Media Controller
    │  — terima multipart upload dari browser
    │  — validasi: tipe file, ukuran max
    │  — forward file ke Go Edge via HTTP POST /internal/media/upload
    │     { domain, folder, file binary }
    ▼
Go Edge: Media Handler
    │  — simpan file ke:
    │     runtime/public/tenants/{domain}/media/{folder}/{YYYY}/{MM}/{filename}
    │  — return: path relatif file yang tersimpan
    ▼
CI4: simpan metadata ke DB (tabel `cms_media`)
    │  — nama_asli, nama_file, folder, path, tipe, ukuran, organisasi_id, uploaded_by
    ▼
File langsung bisa diakses publik via Go Edge URL
```

### Task CI4 — `pages/redaksi/Media/`
- [ ] Controller `Media.php` — CRUD folder + upload + list file + hapus
- [ ] Model `ValMedia.php` + tabel `cms_media` (metadata saja, tidak simpan file di CI4)
- [ ] Tabel `cms_media_folder` — `id, organisasi_id, nama, parent_id (nullable), created_by`
- [ ] Tabel `cms_media` — `id, organisasi_id, folder_id, nama_asli, nama_file, path, tipe, ukuran, tahun, bulan, uploaded_by, created_at`
- [ ] Views: file manager (grid/list), panel folder di kiri, file di kanan
- [ ] CRUD folder: buat folder baru, rename, hapus (hapus folder harus kosong atau konfirmasi)
- [ ] Upload: multipart ke CI4 → forward ke Go Edge → simpan metadata
- [ ] Upload multiple file sekaligus
- [ ] Filter tampilan: semua / gambar / dokumen / video
- [ ] Hapus file: hapus metadata di DB + kirim sinyal hapus ke Go Edge
- [ ] Integrasi ke rich text editor (berita, halaman) — picker file dari media manager
- [ ] Validasi tipe file yang diizinkan (whitelist: jpg, png, gif, webp, pdf, docx, xlsx)
- [ ] Validasi ukuran maksimal per file (configurable di settings)

## Konten (Page Builder) — *Modul belum ada*
- [ ] Buat modul Konten dari awal
- [ ] Controller, Model, Views, Config/Routes
- [ ] Widget/block konten per halaman (banner, teks, galeri, berita terbaru)
- [ ] Atau tentukan dulu: apakah ini perlu atau Halaman cukup?

## Agenda — *Modul belum ada*
- [ ] Buat modul `Agenda` dari awal — `pages/redaksi/Agenda/`
- [ ] CRUD event/agenda: judul, deskripsi, lokasi, tanggal mulai, tanggal selesai
- [ ] Status: `draft` / `published` — 2 tombol (Simpan Draft | Publish)
- [ ] Di situs publik: tampil sebagai list agenda (filter: akan datang / sudah lewat)
- [ ] Views: list agenda (datatable), form tambah/edit
- [ ] Tombol Unpublish

## Pejabat — *Modul belum ada*
- [ ] Buat modul `Pejabat` dari awal — `pages/redaksi/Pejabat/`
- [ ] CRUD profil pejabat: foto, nama, jabatan, periode (mulai–selesai), bio singkat
- [ ] Urutan tampilan (input angka urutan)
- [ ] Status: `draft` / `published` — 2 tombol
- [ ] Views: list pejabat (grid/tabel), form tambah/edit
- [ ] Tombol Unpublish

## Komentar — *Modul belum ada*
- [ ] Buat modul Komentar dari awal
- [ ] Komentar publik untuk berita/halaman
- [ ] Moderation: approve, reject, spam
- [ ] Notifikasi ke redaksi saat komentar baru

## Tema Editor — *Modul belum ada*
> `pages/redaksi/Tema/` — admin tenant bisa duplicate tema base lalu edit kodenya
> Dua sub-fitur: **Code Editor** (CSS/HTML) dan **Pengaturan Tampilan** (form visual, menu terpisah)

### A. Code Editor (edit kode tema duplikat)

**Alur:**
```
Admin pilih tema base → klik Duplicate
    │  POST redaksi/tema/duplicate { base: "default" }
    ▼
CI4: insert record tema baru milik tenant
    nama: "acehprov-custom-1", base: "default"
    ▼
Admin buka editor → edit CSS / edit template HTML per layout
    ▼
Admin klik "Publish Tema"
    ▼
CI4: kirim sinyal ke Go Edge
    { action: "update_theme", domain, tema_id, files: { css, templates } }
    ▼
Go Edge: tulis ke runtime/public/tenants/{domain}/theme/
    situs publik langsung pakai tema baru
```

**Task CI4:**
- [ ] Buat modul `Tema` — `pages/redaksi/Tema/` (Controllers, Models, Views, Config/Routes)
- [ ] Controller: list tema, duplicate, edit, publish, hapus
- [ ] Tabel DB: `cms_tema` — `id, organisasi_id, nama, base_tema, css_custom, templates (JSON), published_at, ...`
- [ ] Duplicate tema: salin CSS + daftar template dari tema base ke record baru milik tenant
- [ ] Code editor CSS — CodeMirror/Monaco di Views
- [ ] Code editor template HTML per layout (home, berita, halaman, galeri, dll)
- [ ] Preview tema sebelum publish (iframe render halaman publik dengan tema baru)
- [ ] Publish tema: push payload ke Go Edge, update `tenant.json` dengan `tema_id` baru
- [ ] Permission: hanya ADMIN/REDAKSI tenant sendiri yang bisa edit tema miliknya

**Batasan:**
- [ ] Tema `default` **read-only** — tidak bisa diedit, hanya bisa di-duplicate
- [ ] Admin tenant tidak bisa edit tema milik tenant lain (`organisasi_id` scope)
- [ ] Superadmin panel bisa kelola daftar tema base, tapi `default` tetap terkunci

---

### B. Pengaturan Tampilan — *Menu Tersendiri*
> `pages/redaksi/Tampilan/` — form isian visual (logo, warna, kontak, dll)
> **Terpisah dari code editor tema.**
> Disimpan di DB, di-push ke Go Edge sebagai `settings.json` per tenant.
> Go Edge membaca `settings.json` saat render — inject nilai ke template.
> *(Detail rendering Go Edge akan dibrainstorm terpisah)*

**Isian form (mengikuti apa yang didukung tema default):**
| Field | Tipe | Contoh |
|-------|------|--------|
| Logo | Upload gambar | logo.png |
| Favicon | Upload gambar | favicon.ico |
| Nama Organisasi | Text | Pemerintah Aceh |
| Tagline / Motto | Text | Maju Bersama |
| Warna Utama | Color picker | #006B3C |
| Warna Sekunder | Color picker | #FFD700 |
| Font Heading | Select | Poppins, Merriweather, ... |
| Font Body | Select | Open Sans, Roboto, ... |
| Alamat | Textarea | Jl. T. Nyak Arief No.219 |
| Telepon | Text | (0651) 123456 |
| Email Kontak | Text | info@acehprov.go.id |
| Link Media Sosial | Text (per platform) | Facebook, Instagram, YouTube, X |
| Footer Copyright | Text | © 2025 Pemerintah Aceh |
| Google Analytics ID | Text | G-XXXXXXXXXX (opsional) |

**Task CI4:**
- [ ] Buat modul `Tampilan` — `pages/redaksi/Tampilan/` (Controllers, Models, Views, Config/Routes)
- [ ] Controller: tampilkan form, simpan, publish ke Go Edge
- [ ] Tabel DB: `cms_tampilan` — `id, organisasi_id, settings (JSON), published_at, ...`
- [ ] Form dengan semua field di atas + upload logo/favicon
- [ ] Simpan sebagai JSON di kolom `settings`
- [ ] Publish: kirim sinyal ke Go Edge `{ action: "update_settings", domain, settings: {...} }`
- [ ] Go Edge tulis ke `runtime/public/tenants/{domain}/settings.json`
- [ ] Preview: tampilkan contoh render dengan nilai settings saat ini
- [ ] Permission: hanya ADMIN/REDAKSI tenant sendiri

## Publish Trigger
- [ ] Setiap CRUD modul CMS → trigger publish signal ke frontend edge via API/gRPC
- [ ] Publish bisa manual (tombol) atau otomatis saat status berubah ke "published"
- [ ] Log publish history per konten

## Testing & QA
- [ ] Cek semua upload file masuk ke folder tenant yang benar
- [ ] Cek `organisasi_id` scope di semua query (jangan cross-tenant leak)
- [ ] Cek permission check tiap method controller
- [ ] Cek slug unique per tenant
