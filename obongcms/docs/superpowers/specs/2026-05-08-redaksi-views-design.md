# Design Spec: Redaksi Views — Modul Standar

**Tanggal**: 2026-05-08
**Status**: Approved
**Scope**: Views modul standar CRUD Redaksi — Kategori, Halaman, Pengumuman, Slider, SEO
**Di luar scope**: Galeri, Menu (spec terpisah)

---

## 1. Pattern Baseline

Semua modul mengikuti pattern Berita yang sudah berjalan:

```
index.html  → DataTable AJAX, toolbar tombol Tambah, aksi per row
form.html   → form tambah/edit, tombol aksi di bawah
```

**Aksi per row — konten dengan status draft/terbit:**

| Status | Aksi tersedia |
|--------|---------------|
| `draft` | Edit \| **Publish** \| Hapus |
| `terbit` | Edit \| **Unpublish** \| Hapus |

**Tombol form — konten dengan status:**
- `Simpan Draft` — POST dengan `action=draft`
- `Publish` — POST dengan `action=publish`

**Konten tanpa konsep draft/publish** (Kategori, Slider):
- Satu tombol `Simpan`
- Tidak ada kolom status di DataTable

---

## 2. Modul Kategori

### Behavior

- Tidak punya draft/publish — langsung aktif saat disimpan
- Tidak push JSON langsung ke Go Edge — kategori ikut ter-embed di `berita.json` saat berita di-publish
- Hapus kategori: cek apakah masih dipakai berita (`cms_berita.kategori_id`) — tolak dengan pesan error jika masih ada

### `index.html`

DataTable kolom: No | Nama | Slug | Urutan | Status | Aksi

Aksi per row: Edit | Hapus

### `form.html`

Field:
- `nama` — text, required
- `slug` — text, auto-generate dari nama (bisa override manual), unique per tenant
- `urutan` — number, default 0
- `status` — select: aktif / nonaktif

Tombol: **Simpan**

### Controller Method

```
index()     → Permission: redaksi.kategori.read
jsonData()  → Permission: redaksi.kategori.read
create()    → Permission: redaksi.kategori.upsert
store()     → Permission: redaksi.kategori.upsert
            → validasi slug unique per tenant
            → upsert cms_berita_kategori
delete()    → Permission: redaksi.kategori.delete
            → cek relasi ke cms_berita sebelum hapus
```

---

## 3. Modul Halaman

### Behavior

- Mirip Berita — draft/publish/unpublish
- Slug diisi **manual** oleh user (bukan auto-generate dari judul), validasi unique per tenant
- Tidak ada kategori, tidak ada field penulis
- Body: rich text WYSIWYG (sama seperti Berita)

### Push ke Go Edge

Saat publish:
```
halaman/{slug}.json  → detail halaman
halaman.json         → list semua halaman terbit (slug, judul, updated_at)
```

Saat unpublish:
```
hapus halaman/{slug}.json
rebuild halaman.json (tanpa halaman ini)
```

### `index.html`

DataTable kolom: No | Judul | Slug | Status | Aksi

Aksi: Edit | Publish/Unpublish | Hapus

### `form.html`

Field:
- `judul` — text, required
- `slug` — text, required, manual input, unique per tenant
- `isi` — rich text WYSIWYG, required

Tombol: **Simpan Draft** | **Publish**

### Controller Method

```
index()       → Permission: redaksi.halaman.read
jsonData()    → Permission: redaksi.halaman.read
create()      → Permission: redaksi.halaman.upsert
store()       → Permission: redaksi.halaman.upsert
              → validasi slug unique per tenant
              → sanitizeHtml(isi), extractBase64Images(isi)
              → upsert cms_halaman
              → jika action=publish → triggerPublish()
publish()     → Permission: redaksi.halaman.upsert → triggerPublish()
unpublish()   → Permission: redaksi.halaman.upsert → hapus JSON + rebuild list
delete()      → Permission: redaksi.halaman.delete
              → jika status terbit → unpublish dulu (hapus JSON) → lalu soft delete

triggerPublish(halaman, domain):
    files = [
        { path: 'halaman/{slug}.json', content: detail JSON },
        { path: 'halaman.json',        content: list JSON },
    ]
    GoEdge::publishContent(domain, files)
```

---

## 4. Modul Pengumuman

### Behavior

- Draft/publish/unpublish seperti Berita
- Field tambahan: `tanggal_mulai` (date, required saat publish) dan `tanggal_selesai` (date, opsional)
- Tidak ada thumbnail, tidak ada kategori
- `tanggal_selesai` kosong = tidak ada batas waktu
- Filter expired di Go Edge saat render (bukan di CI4) — CI4 hanya simpan dan push data

### Push ke Go Edge

Saat publish/unpublish: rebuild `pengumuman.json` — list semua pengumuman terbit (termasuk yang sudah lewat tanggal_selesai, Go Edge yang filter).

```json
{
  "items": [
    {
      "slug": "pengumuman-rekrutmen",
      "judul": "Rekrutmen CPNS 2026",
      "ringkasan": "...",
      "tanggal_mulai": "2026-05-01",
      "tanggal_selesai": "2026-06-01",
      "tanggal_terbit": "2026-05-08"
    }
  ],
  "updated_at": "2026-05-08T10:00:00Z"
}
```

### `index.html`

DataTable kolom: No | Judul | Tanggal Mulai | Tanggal Selesai | Status | Aksi

Aksi: Edit | Publish/Unpublish | Hapus

### `form.html`

Field:
- `judul` — text, required
- `ringkasan` — textarea, opsional
- `tanggal_mulai` — date, required saat publish
- `tanggal_selesai` — date, opsional

Tombol: **Simpan Draft** | **Publish**

### Controller Method

```
index()      → Permission: redaksi.pengumuman.read
jsonData()   → Permission: redaksi.pengumuman.read
create()     → Permission: redaksi.pengumuman.upsert
store()      → Permission: redaksi.pengumuman.upsert
             → validasi: tanggal_selesai harus >= tanggal_mulai jika diisi
             → upsert cms_pengumuman
             → jika action=publish → triggerPublish()
publish()    → Permission: redaksi.pengumuman.upsert → triggerPublish()
unpublish()  → Permission: redaksi.pengumuman.upsert → rebuild pengumuman.json
delete()     → Permission: redaksi.pengumuman.delete → soft delete

triggerPublish(tenantId, domain):
    ambil semua pengumuman terbit tenant → build list JSON
    GoEdge::publishContent(domain, [{ path: 'pengumuman.json', content: list JSON }])
```

---

## 5. Modul Slider

### Behavior

- Tidak pakai draft/publish — konsep: **aktif / nonaktif** per item
- Setiap perubahan (simpan, hapus, toggle aktif, ubah urutan) → langsung rebuild + push `slider.json`
- `slider.json` hanya berisi item yang aktif, diurutkan `urutan ASC`
- Gambar wajib diupload — tidak ada slider tanpa gambar

### Push ke Go Edge

```json
{
  "items": [
    {
      "judul": "Selamat Datang",
      "gambar": "/media/berita/2026/05/slider1.jpg",
      "link": "/berita/slug-berita",
      "urutan": 1
    }
  ],
  "updated_at": "2026-05-08T10:00:00Z"
}
```

### `index.html`

DataTable kolom: No | Gambar (thumbnail kecil) | Judul | Urutan | Aktif | Aksi

- Toggle aktif/nonaktif inline (POST AJAX, langsung rebuild slider.json)
- Aksi: Edit | Hapus

### `form.html`

Field:
- `judul` — text, opsional
- `gambar` — file upload, required (jika tambah baru), tampilkan preview jika edit
- `link` — text (URL), opsional
- `urutan` — number, default 0

Tombol: **Simpan** (langsung aktif, lalu push slider.json)

### Controller Method

```
index()      → Permission: redaksi.slider.read
jsonData()   → Permission: redaksi.slider.read
create()     → Permission: redaksi.slider.upsert
store()      → Permission: redaksi.slider.upsert
             → upload gambar via GoEdge media → simpan path
             → upsert cms_slider → triggerRebuild()
toggleAktif() → Permission: redaksi.slider.upsert
              → update status aktif/nonaktif → triggerRebuild()
delete()     → Permission: redaksi.slider.delete → soft delete → triggerRebuild()

triggerRebuild(tenantId, domain):
    ambil semua slider aktif ORDER BY urutan ASC
    GoEdge::publishContent(domain, [{ path: 'slider.json', content: JSON }])
```

---

## 6. Modul SEO

### Behavior

- Tidak punya halaman tambah/hapus sendiri
- Edit meta per konten yang sudah ada (berita + halaman statis yang sudah terbit)
- SEO fields disimpan langsung di tabel konten masing-masing (`cms_berita.meta_title`, `cms_halaman.meta_title`, dll)
- Simpan → re-push JSON konten terkait dengan data SEO terupdate
- Hanya konten berstatus `terbit` yang tampil di list SEO

### `index.html`

Dua tab atau dua tabel: **Berita** | **Halaman**

Kolom per tabel: No | Judul | Slug | Meta Title | Meta Description | Aksi (Edit)

Tidak ada tombol Tambah — konten hanya bisa diedit, bukan dibuat dari sini.

### `form.html` (modal atau halaman terpisah)

Field:
- `meta_title` — text, max 70 karakter (counter karakter)
- `meta_description` — textarea, max 160 karakter (counter karakter)
- `og_image` — URL atau upload gambar

Tombol: **Simpan** → update kolom meta di tabel konten → re-push JSON konten

### Controller Method

```
index()  → Permission: redaksi.seo.read
         → ambil berita terbit + halaman terbit (dengan meta fields)
         → render view dengan dua list

store()  → Permission: redaksi.seo.upsert
         → update cms_berita atau cms_halaman (meta_title, meta_description, og_image)
         → re-push JSON konten terkait:
             berita → berita/{slug}.json (update field meta di JSON)
             halaman → halaman/{slug}.json
         → return jsonSuccess
```

---

## 7. DB Fields Tambahan

Kolom yang perlu ditambah ke tabel yang belum punya:

### `cms_halaman`

```sql
slug           VARCHAR(200) NOT NULL,
isi            LONGTEXT,
status         ENUM('draft','terbit') DEFAULT 'draft',
meta_title     VARCHAR(200) NULL,
meta_description TEXT NULL,
og_image       VARCHAR(500) NULL,
tanggal_terbit DATE NULL,
deleted_at     DATETIME NULL,
deleted_by     VARCHAR(100) NULL
```

### `cms_pengumuman`

```sql
slug           VARCHAR(200) NOT NULL,
ringkasan      TEXT NULL,
tanggal_mulai  DATE NULL,
tanggal_selesai DATE NULL,
status         ENUM('draft','terbit') DEFAULT 'draft',
tanggal_terbit DATE NULL,
deleted_at     DATETIME NULL,
deleted_by     VARCHAR(100) NULL
```

### `cms_slider`

```sql
judul   VARCHAR(200) NULL,
gambar  VARCHAR(500) NOT NULL,
link    VARCHAR(500) NULL,
urutan  INT DEFAULT 0,
aktif   TINYINT(1) DEFAULT 1,
deleted_at DATETIME NULL,
deleted_by VARCHAR(100) NULL
```

### `cms_berita` (tambah kolom yang belum ada)

```sql
meta_title       VARCHAR(200) NULL,
meta_description TEXT NULL,
og_image         VARCHAR(500) NULL
```

---

## 8. JSON Schema Go Edge

### `halaman.json`

```json
{
  "items": [
    { "slug": "tentang-kami", "judul": "Tentang Kami", "updated_at": "2026-05-08" }
  ],
  "updated_at": "2026-05-08T10:00:00Z"
}
```

### `halaman/{slug}.json`

```json
{
  "slug": "tentang-kami",
  "judul": "Tentang Kami",
  "isi": "<p>...</p>",
  "meta_title": "Tentang Kami | Pemerintah Aceh",
  "meta_description": "...",
  "og_image": "...",
  "updated_at": "2026-05-08"
}
```

### `pengumuman.json`

```json
{
  "items": [
    {
      "slug": "rekrutmen-cpns",
      "judul": "Rekrutmen CPNS 2026",
      "ringkasan": "...",
      "tanggal_mulai": "2026-05-01",
      "tanggal_selesai": "2026-06-01",
      "tanggal_terbit": "2026-05-08"
    }
  ],
  "updated_at": "2026-05-08T10:00:00Z"
}
```

### `slider.json`

```json
{
  "items": [
    { "judul": "Selamat Datang", "gambar": "/media/...", "link": "/berita/...", "urutan": 1 }
  ],
  "updated_at": "2026-05-08T10:00:00Z"
}
```

---

## 9. Checklist Implementasi

### Kategori
- [ ] `Kategori.php` — tambah method `delete()` dengan cek relasi
- [ ] `ValKategori.php` — pastikan validasi slug unique per tenant
- [ ] `Views/index.html` — DataTable dengan aksi Edit | Hapus
- [ ] `Views/form.html` — field nama, slug, urutan, status

### Halaman
- [ ] `Halaman.php` — method `publish()`, `unpublish()`, `delete()`, `triggerPublish()`
- [ ] `ValHalaman.php` — validasi slug unique per tenant
- [ ] SQL: tambah kolom ke `cms_halaman` (lihat §7)
- [ ] `Views/index.html` — DataTable dengan publish/unpublish
- [ ] `Views/form.html` — field judul, slug manual, WYSIWYG, 2 tombol

### Pengumuman
- [ ] `Pengumuman.php` — method `publish()`, `unpublish()`, `delete()`, `triggerPublish()`
- [ ] `ValPengumuman.php` — validasi tanggal_selesai >= tanggal_mulai
- [ ] SQL: tambah kolom ke `cms_pengumuman` (lihat §7)
- [ ] `Views/index.html` — DataTable dengan tanggal range + publish/unpublish
- [ ] `Views/form.html` — field judul, ringkasan, tanggal_mulai, tanggal_selesai, 2 tombol

### Slider
- [ ] `Slider.php` — method `toggleAktif()`, `delete()`, `triggerRebuild()`
- [ ] `ValSlider.php` — validasi gambar required saat tambah baru
- [ ] SQL: pastikan skema `cms_slider` sesuai §7
- [ ] `Views/index.html` — DataTable dengan thumbnail + toggle aktif inline
- [ ] `Views/form.html` — field judul, gambar upload + preview, link, urutan

### SEO
- [ ] `Seo.php` — method `index()` (list berita+halaman), `store()` (update meta + re-push)
- [ ] `ValSeo.php` — validasi meta_title max 70, meta_description max 160
- [ ] SQL: tambah kolom meta ke `cms_berita` dan `cms_halaman` (lihat §7)
- [ ] `Views/index.html` — dua tabel (Berita | Halaman) dengan kolom meta
- [ ] `Views/form.html` — field meta_title (counter), meta_description (counter), og_image
