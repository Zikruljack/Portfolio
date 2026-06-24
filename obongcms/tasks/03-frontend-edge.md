# Frontend – Go Edge
> Stack: Go, Chi v5, sqlx, MySQL, gRPC
> Path: `frontend/`
> Peran: multi-domain resolver + renderer + publish cache (tanpa DB access langsung ke CMS)

## Base Infrastructure — *Done*
- [x] Config loader (`base/config/`)
- [x] Middleware: auth, CSRF, rate limit, security headers, logger
- [x] View/template engine (`base/views/`)
- [x] Helpers: response, template, umum
- [x] gRPC proto generated (`internal/grpcserver/gen/`)

## Domain Resolver
> `modules/domainresolver/`
- [ ] Implementasi: query domain dari backend API atau local config
- [ ] Cache domain mapping (TTL, invalidasi)
- [ ] Fallback jika domain tidak ditemukan (404 page)
- [ ] Support subdomain
- [ ] Hot reload config tanpa restart

## Tenant File System (TenantFS)
> `modules/tenantfs/`
- [ ] Implementasi: manajemen folder tenant di `runtime/public/tenants/{domain}/`
- [ ] Buat folder tenant baru saat provisioning
- [ ] Hapus/archive folder saat tenant dinonaktifkan
- [ ] Validasi: jangan serve file di luar folder tenant sendiri

## Publish Cache
> `modules/publishcache/`
- [ ] Implementasi: terima publish signal dari backend (via gRPC atau HTTP internal)
- [ ] Simpan snapshot konten ke `runtime/public/tenants/{domain}/`
- [ ] Format snapshot: JSON + HTML yang sudah di-render
- [ ] Invalidasi cache saat ada publish baru
- [ ] Log publish event

## Renderer
> `modules/renderer/`
- [ ] Implementasi: render template HTML dari snapshot + tema
- [ ] Load tema dari `shared/themes/{tema_id}/`
- [ ] Variable template: judul, deskripsi, berita, menu, slider, dll
- [ ] Fallback graceful jika snapshot kosong/belum ada
- [ ] Support multi-layout per tipe halaman (home, berita, halaman statis)

### Menu Renderer
> Baca `menu.json` per tenant → render HTML navigasi dengan dukungan dropdown.
> Go yang generate HTML menu, bukan CI4.

```json
// Contoh menu.json yang dibaca Go Edge
[
  { "id": 1, "label": "Beranda", "url": "/", "target": "_self", "children": [] },
  { "id": 2, "label": "Profil", "url": "#", "target": "_self", "children": [
      { "id": 3, "label": "Sejarah", "url": "/halaman/sejarah", "target": "_self", "children": [] }
  ]}
]
```

- [ ] Fungsi `RenderMenu(items []MenuItem) string` — rekursif, generate HTML `<ul><li>` nested
- [ ] Item tanpa children → `<li><a href="...">Label</a></li>`
- [ ] Item dengan children → `<li class="has-dropdown"><a>Label</a><ul>...rekursif...</ul></li>`
- [ ] Attribute `target` di-inject ke `<a target="...">`
- [ ] Class CSS mengikuti tema yang aktif (inject class dari `settings.json` jika ada)
- [ ] Output di-inject ke variable template sebelum render halaman

## Media Handler
> `modules/media/` — terima upload dari CI4, simpan file, serve ke publik

### Struktur Folder
```
runtime/public/tenants/{domain}/media/
└── {nama-folder}/
    └── {YYYY}/
        └── {MM}/
            └── {filename}
```

### Task
- [ ] Endpoint `POST /internal/media/upload` — terima file dari CI4
  - validasi: domain exists, folder valid, tipe file whitelist
  - tulis file ke path yang benar
  - return: `{ path: "media/berita/2025/05/foto.jpg" }`
- [ ] Endpoint `DELETE /internal/media/delete` — hapus file spesifik
  - validasi: path dalam scope tenant yang benar (cegah path traversal)
- [ ] Endpoint `GET /media/{folder}/{year}/{month}/{file}` — serve file publik
  - atau via Nginx langsung serve folder `runtime/public/tenants/{domain}/` (lebih efisien)
- [ ] Buat folder `{YYYY}/{MM}` otomatis jika belum ada (`os.MkdirAll`)
- [ ] Sanitasi nama file saat disimpan (hapus karakter spesial, slug-friendly)
- [ ] Validasi path tidak keluar dari folder tenant (path traversal protection)
- [ ] Auth endpoint internal: API key di header `X-Internal-Key`

## gRPC Server + mTLS
> `internal/grpcserver/`
> **Prioritas tinggi** — CI4 dan Go Edge beda server, komunikasi internal harus pakai mTLS

### Sertifikat mTLS
- [ ] Generate self-signed CA + cert untuk Go Edge (server cert)
- [ ] Generate client cert untuk CI4 (client cert)
- [ ] Simpan cert di path yang aman, jangan di repo — konfigurasi via env/config

### Go Edge — gRPC Server
- [ ] Aktifkan gRPC server dengan TLS (`grpc.NewServer` + `credentials.NewTLS`)
- [ ] Bind port gRPC ke IP internal saja (bukan 0.0.0.0) — tidak expose ke publik
- [ ] Implementasi handler `SyncTenant` — terima config tenant baru
- [ ] Implementasi handler `PublishContent` — terima konten ter-publish
- [ ] Implementasi handler `InvalidateDomain` — invalidasi cache domain
- [ ] Validasi client cert di setiap request (mTLS — tolak koneksi tanpa cert valid)
- [ ] Fallback: jika gRPC gagal, log error — jangan silent fail

### CI4 Backend — gRPC Client
> `base/Libraries/GoEdgeGrpc.php` (gantikan `GoEdge.php` setelah siap)
- [ ] Install PHP gRPC extension (`ext-grpc`) + `grpc/grpc` composer package
- [ ] Buat client dengan client cert (mTLS) — verifikasi server cert Go Edge
- [ ] Method: `syncTenant()`, `publishContent()`, `invalidateDomain()`
- [ ] Switch `GoEdge.php` dari HTTP POST ke gRPC setelah Go Edge side siap
- [ ] Hapus endpoint HTTP internal `/api/internal/*` setelah migrasi selesai

## Routing & Main
> `main.go` + `cmd/aceh-edge/`
- [~] Entry point `main.go` ada
- [ ] Wiring semua modul ke Chi router
- [ ] Route: `GET /{path...}` — resolve domain → render konten
- [ ] Route: `POST /internal/sync` — receive publish dari backend
- [ ] Route: `POST /internal/media/upload` — receive file upload dari CI4
- [ ] Route: `DELETE /internal/media/delete` — hapus file dari CI4
- [ ] Graceful shutdown

## Template Themes
> `shared/themes/`
- [ ] Buat 1 tema default (basic, responsif) — `shared/themes/default/`
- [ ] Layout: `base.html`, `home.html`, `berita.html`, `halaman.html`, `galeri.html`
- [ ] Include partial: header, footer, sidebar, menu, breadcrumb
- [ ] Asset: CSS, JS minimal (atau link ke CDN)

## Default Tema saat Tenant Dibuat
> Saat Go Edge terima sinyal `create_tenant` dari CI4, tema default otomatis diset.
- [ ] `tenant.json` yang ditulis saat provisioning wajib include field `tema_id: "default"`
- [ ] Renderer baca `tema_id` dari `tenant.json` → load tema sesuai urutan prioritas (lihat bawah)
- [ ] Fallback: jika tema custom tidak ada → fallback ke `shared/themes/default/`
- [ ] Jika folder `shared/themes/default/` sendiri belum ada → log error + return 503 informatif

## Urutan Prioritas Load Tema (Renderer)
```
1. runtime/public/tenants/{domain}/theme/   ← tema custom hasil edit admin tenant
        ↓ tidak ada?
2. shared/themes/{tema_id}/                 ← tema base yang dipilih saat duplicate
        ↓ tidak ada?
3. shared/themes/default/                   ← fallback mutlak
        ↓ tidak ada?
4. Return HTTP 503 + log error
```

## Tema Custom (Push dari CI4)
> CI4 kirim sinyal `update_theme` setelah admin tenant publish tema — Go Edge tulis file ke folder tenant.
- [ ] Handler terima sinyal `update_theme`:
  - payload: `{ domain, tema_id, css_custom, templates: { "home.html": "...", ... } }`
- [ ] Tulis `runtime/public/tenants/{domain}/theme/custom.css` dari `css_custom`
- [ ] Tulis tiap file template dari `templates` ke `runtime/public/tenants/{domain}/theme/`
- [ ] Update `tenant.json` field `tema_id` ke nilai baru
- [ ] Invalidasi cache render untuk domain tersebut
- [ ] Validasi: pastikan path tidak keluar dari folder tenant (cegah path traversal)

## Dashboard Frontend (opsional)
> `modules/dashboard/`
- [~] `handler.go` ada (scaffolded)
- [ ] Halaman status edge: domain aktif, cache hit/miss, uptime
- [ ] Protected route (basic auth atau API key)

## Testing & QA
- [ ] Unit test: domain resolver logic
- [ ] Unit test: tenant FS path validation (jangan path traversal)
- [ ] Integration test: end-to-end request domain → render HTML
- [ ] Load test: concurrent request banyak domain
- [ ] Cek tidak ada DB access langsung dari edge (hanya baca file/cache)
