# ObongCMS — MVP Design Spec
> Tanggal: 2026-05-07
> Pendekatan: Vertical Slice (B)
> Tujuan: Development reference + demo minimal 1 domain bisa publish berita ke publik

---

## Scope MVP

### Yang Dibangun

| Area | Komponen |
|------|----------|
| Panel (CI4) | Login DEV, buat Tenant, buat Domain, buat user ADMIN_TENANT |
| Redaksi (CI4) | Login ADMIN_TENANT, CRUD Berita, Publish, Unpublish |
| API (CI4) | `/api/domain/{domain}`, `/api/content/{domain}/berita`, `/api/content/{domain}/berita/{slug}` |
| Go Edge | Domain resolver, `/internal/sync` handler, `/internal/media/upload` handler, render berita list + detail, 1 tema default |

### Yang Di-cut (Post-MVP)

Galeri, Pengumuman, Slider, Menu builder, Media manager, Tema editor, Halaman statis, Agenda, Pejabat, Komentar, ADMIN_WILAYAH scope filter.

---

## Build Order — 4 Milestone

### Milestone 1 — Panel: buat 1 domain
1. Selesaikan Tenant: controller + views (form tambah, list)
2. Selesaikan Domain: controller + views (form tambah, assign ke tenant)
3. Buat user ADMIN_TENANT + assign ke tenant
4. Verifikasi: DEV login → buat tenant → buat domain → buat user ADMIN_TENANT

### Milestone 2 — Redaksi: publish berita
5. Auth filter scope tenant (ADMIN_TENANT hanya akses tenant-nya sendiri)
6. Selesaikan Berita: list (datatable), form tambah/edit, upload thumbnail (staging sementara di CI4 → forward ke Go Edge → hapus dari CI4), slug auto-generate
7. Tombol: Simpan Draft | Publish | Unpublish
8. Publish trigger: CI4 → HTTP POST `/internal/sync` ke Go Edge
9. Verifikasi: ADMIN_TENANT login → buat berita → publish → snapshot JSON terbuat di folder tenant

### Milestone 3 — Go Edge: publik bisa baca
10. `/internal/sync` handler: terima payload, tulis snapshot JSON ke `runtime/public/tenants/{domain}/` (path di Go Edge server)
10a. `/internal/media/upload` handler: terima file dari CI4, simpan ke `runtime/public/tenants/{domain}/media/{folder}/{YYYY}/{MM}/{filename}` (path di Go Edge server), return path relatif
11. Domain resolver: baca `Host` header → resolve ke tenant (baca dari API atau local cache)
12. Render berita list: `/berita` → baca `berita.json`
13. Render berita detail: `/berita/{slug}` → baca `berita/{slug}.json`
14. Tema default: header, list card berita, halaman detail — presentable untuk demo
15. Verifikasi end-to-end: publish dari redaksi → langsung muncul di situs publik

### Milestone 4 — API endpoint (backup / Go Edge fallback)
16. `GET /api/domain/{domain}` — config tenant
17. `GET /api/content/{domain}/berita` — list berita published
18. `GET /api/content/{domain}/berita/{slug}` — detail berita

> M1 → M2 → M3 berurutan. M4 bisa paralel setelah M2.

---

## Data Flow

### Publish Flow

```
Redaksi klik Publish
    │
    ▼
CI4 Berita Controller
    │  — update status → "published" di DB
    │  — HTTP POST /internal/sync ke Go Edge
    │    Header: X-Internal-Key: {shared_secret}
    │    Body: {
    │      "action": "publish_content",
    │      "domain": "acehprov.go.id",
    │      "type": "berita",
    │      "data": { slug, judul, excerpt, body, thumbnail, kategori, published_at }
    │    }
    ▼
Go Edge /internal/sync handler
    │  — validasi X-Internal-Key
    │  — tulis/update:
    │      runtime/public/tenants/{domain}/berita.json
    │      runtime/public/tenants/{domain}/berita/{slug}.json
    ▼
Request publik berikutnya langsung baca snapshot terbaru
```

### Thumbnail Upload Flow

```
Redaksi upload thumbnail di form berita
    │
    ▼
CI4 Berita Controller
    │  — terima file, simpan sementara ke CI4 public/uploads/temp/
    │  — HTTP POST /internal/media/upload ke Go Edge
    │    Header: X-Internal-Key: {shared_secret}
    │    Body: multipart { domain, folder: "berita", file }
    ▼
Go Edge /internal/media/upload handler
    │  — simpan ke (path di Go Edge server):
    │      runtime/public/tenants/{domain}/media/berita/{YYYY}/{MM}/{filename}
    │  — return: { path: "/media/berita/2025/05/foto.jpg" }
    ▼
CI4
    │  — simpan path ke DB
    │  — hapus file temp dari CI4
```

### Unpublish Flow

```
CI4 kirim: { "action": "unpublish_content", "domain": "...", "type": "berita", "slug": "..." }
Go Edge: hapus berita/{slug}.json, remove item dari berita.json
```

---

## Struktur Snapshot JSON

### `berita.json` (list)
```json
{
  "items": [
    {
      "slug": "judul-artikel",
      "judul": "Judul Artikel",
      "excerpt": "Ringkasan singkat...",
      "thumbnail": "/media/berita/2025/05/foto.jpg",
      "kategori": "Pemerintahan",
      "published_at": "2025-05-07T10:00:00Z"
    }
  ],
  "updated_at": "2025-05-07T10:00:00Z"
}
```

### `berita/{slug}.json` (detail)
```json
{
  "slug": "judul-artikel",
  "judul": "Judul Artikel",
  "body": "<p>Konten HTML...</p>",
  "thumbnail": "/media/berita/2025/05/foto.jpg",
  "kategori": "Pemerintahan",
  "published_at": "2025-05-07T10:00:00Z"
}
```

---

## Keamanan Internal Sync

- Go Edge tolak request ke `/internal/sync` dan `/internal/media/upload` tanpa header `X-Internal-Key` valid
- Key disimpan di `.env` kedua server (CI4 dan Go Edge)
- Endpoint tidak diekspos ke publik (firewall / Nginx block `/internal/` dari luar)

---

## Definisi Selesai (Definition of Done)

MVP dianggap selesai jika:
1. DEV bisa login panel, buat tenant, buat domain, buat user ADMIN_TENANT
2. ADMIN_TENANT bisa login redaksi, buat berita, klik Publish
3. Dalam < 2 detik setelah publish, berita muncul di `http://{domain}/berita`
4. Berita detail bisa diakses di `http://{domain}/berita/{slug}`
5. Unpublish menghapus berita dari situs publik
