# ObongCMS — Arsitektur & Alur Sistem

## Gambaran Besar

Platform CMS multi-tenant untuk berita dan web pemerintahan.
Satu instalasi bisa melayani banyak domain/organisasi sekaligus.
Dua mode deploy: **Public** (shared cloud) dan **Private** (on-prem pemerintahan).

---

## Topologi Sistem

```
                        INTERNET
                           │
              ┌────────────┼────────────┐
              │                         │
    ┌─────────▼──────────┐   ┌──────────▼─────────┐
    │  SERVER FRONTEND   │   │   SERVER BACKEND    │
    │  (Go Edge)         │   │   (CI4 Panel)       │
    │  Port: 80/443      │   │   Port: 8080/443    │
    └─────────┬──────────┘   └──────────┬──────────┘
              │                          │
              │   gRPC / HTTP internal   │
              └─────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   MySQL Database     │
                              │   (single instance)  │
                              └─────────────────────┘
```

**Frontend** tidak punya akses DB langsung.
**Backend** adalah satu-satunya yang menulis ke DB dan ke folder tenant.

---

## Komponen

| Komponen | Stack | Peran |
|----------|-------|-------|
| **Panel** | CI4 (`pages/panel/`) | Superadmin: kelola domain, tenant, user platform |
| **Redaksi** | CI4 (`pages/redaksi/`) | Editor per-tenant: kelola konten CMS |
| **API** | CI4 (`pages/panel/Api/`) | Endpoint JSON untuk edge + publish trigger |
| **Go Edge** | Go (`frontend/`) | Multi-domain resolver, renderer, serve ke publik |

---

## Alur 1 — User Akses Situs Publik

```
User Browser
    │
    │  GET https://acehprov.go.id/berita/judul-artikel
    ▼
Nginx (frontend server)
    │  — semua request → Go Edge
    ▼
Go Edge: Domain Resolver
    │  — baca domain dari Host header
    │  — cari mapping: "acehprov.go.id" → organisasi_id=42, tema="default"
    │  — lookup dari local cache (di-load dari backend API saat startup/refresh)
    ▼
Go Edge: Tenant FS
    │  — buka folder: runtime/public/tenants/acehprov.go.id/
    │  — baca snapshot JSON: berita.json, menu.json, slider.json, dll
    ▼
Go Edge: Renderer
    │  — load tema dari: shared/themes/default/
    │  — render template HTML: berita.html + data snapshot
    ▼
Response HTML ke Browser
```

**Catatan**: Go Edge tidak query DB sama sekali — hanya baca file snapshot lokal.

---

## Alur 2 — Redaksi Publish Berita

```
Editor (browser)
    │
    │  POST panel/redaksi/berita/publish/{id}
    ▼
CI4 Backend (Redaksi Controller)
    │  — validasi session + permission
    │  — update status berita → "published" di DB
    │  — generate snapshot JSON berita tenant
    │  — kirim publish signal ke Go Edge
    ▼
CI4 API: Publish Trigger
    │  — HTTP POST internal ke Go Edge: /internal/sync
    │  — atau gRPC: EdgeSync.PublishContent(organisasi_id, type, data)
    ▼
Go Edge: Publish Cache Handler
    │  — terima payload konten ter-publish
    │  — tulis/update file snapshot:
    │      runtime/public/tenants/acehprov.go.id/berita.json
    │      runtime/public/tenants/acehprov.go.id/berita/{slug}.json
    │  — invalidasi cache in-memory jika ada
    ▼
Selesai — request publik berikutnya langsung baca snapshot terbaru
```

---

## Alur 3 — Login Panel (Superadmin / Redaksi)

```
Admin Browser
    │
    │  POST panel/auth/login
    ▼
CI4 Auth Controller
    │  — cek email + password (bcrypt)
    │  — jika 2FA aktif → kirim OTP ke email
    ▼
OTP Verification (opsional)
    │  — POST panel/auth/otp
    │  — cek kode OTP, cek expired_at, cek max attempts
    ▼
Session dibuat
    │  — simpan session ke app_sessions
    │  — set session cookie (HttpOnly, SameSite=Strict)
    ▼
Redirect ke Dashboard
    │
    │  Setiap request berikutnya:
    │  — CI4 Auth Filter cek session valid
    │  — CI4 Permission Filter cek module.action vs level user
    ▼
Akses modul sesuai permission level
```

**Level akses:**
| Level | Flag | Akses Panel | Akses Redaksi |
|-------|------|------------|---------------|
| Developer | DEV | Semua | Semua tenant |
| Admin Wilayah | ADMIN_WILAYAH | Terbatas wilayah (create tenant, manage user wilayah) | — |
| Admin Tenant | ADMIN_TENANT | — | Semua modul + manage user tenant sendiri |
| Redaksi | REDAKSI | — | Konten saja (tanpa manage user) |

> **Aturan akses `/panel/`:** hanya DEV dan ADMIN_WILAYAH.
> **Aturan akses `/redaksi/`:** hanya ADMIN_TENANT dan REDAKSI (scope per tenant via `app_users_tenant`).
> **ADMIN_WILAYAH scope:** dibatasi di level code — query `app_users_wilayah` untuk filter wilayah, bukan di permission table.

---

## Alur 4 — Provisioning Tenant Baru

```
Superadmin
    │
    │  POST panel/domain/tambah → isi: nama domain, organisasi
    ▼
CI4: Domain Controller (backend server)
    │  — insert ke tabel `domain`
    │  — insert ke tabel `tenant` (link domain → organisasi)
    │  — kirim sinyal ke Go Edge:
    │      gRPC: SyncTenant(domain, organisasi_id, tema)
    │      atau HTTP POST /internal/sync { action: "create_tenant", ... }
    ▼
Go Edge: Tenant FS (frontend server)          ← FOLDER DIBUAT DI SINI
    │  — terima sinyal dari CI4
    │  — os.MkdirAll("runtime/public/tenants/{domain}/", 0755)
    │  — tulis tenant.json (tema, nama org, pengaturan dasar)
    ▼
Tenant siap — domain sudah bisa diakses
(halaman default sampai konten di-publish)
```

> **Aturan**: CI4 **tidak pernah** langsung menulis ke folder frontend.
> CI4 hanya kirim sinyal — Go Edge yang eksekusi pembuatan folder di filesystem-nya sendiri.
> Ini memastikan arsitektur tetap bisa scale ke 2 server terpisah.

---

## Alur 5 — Multi-Domain di Nginx

```
Nginx (frontend server) config:

    server {
        listen 443 ssl;
        server_name _;           ← tangkap semua domain

        location / {
            proxy_pass http://go-edge:8080;
            proxy_set_header Host $host;    ← forward domain asli
        }
    }

Go Edge membaca $host dari header → resolve ke tenant yang benar.
Tidak perlu config Nginx per domain baru — cukup tambah domain di panel.
```

---

## Struktur Data Tenant

```
runtime/
└── public/
    └── tenants/
        ├── acehprov.go.id/
        │   ├── tenant.json          ← config: tema, nama org, pengaturan
        │   ├── menu.json
        │   ├── slider.json
        │   ├── berita.json          ← list berita terbaru
        │   ├── berita/
        │   │   ├── judul-artikel.json
        │   │   └── ...
        │   ├── halaman/
        │   │   ├── tentang-kami.json
        │   │   └── ...
        │   └── uploads/             ← file media tenant
        └── dinas-kesehatan.go.id/
            └── ...
```

---

## Struktur Database

```
Single MySQL instance, multi-tenant via organisasi_id:

Platform (shared):
  ├── app_users             ← semua user (DEV, ADMIN_WILAYAH, ADMIN_TENANT, REDAKSI)
  ├── app_users_level       ← 4 role: DEV|ADMIN_WILAYAH|ADMIN_TENANT|REDAKSI
  ├── app_users_detail      ← profil user
  ├── app_users_tenant      ← scope ADMIN_TENANT+REDAKSI ke tenant tertentu
  ├── app_users_wilayah     ← scope ADMIN_WILAYAH ke wilayah tertentu
  ├── app_modules           ← daftar permission module.action
  ├── app_permissions       ← mapping level → module
  ├── app_sessions          ← session storage CI4
  ├── app_settings          ← konfigurasi global + per-tenant
  ├── app_activity          ← audit log
  └── app_otp               ← OTP email

Wilayah & Tenant:
  ├── app_wilayah           ← provinsi + kabkota (parent_id untuk hierarki)
  ├── app_tenants           ← instansi/organisasi (wilayah_id, tema_id)
  └── app_domains           ← domain per tenant (acehprov.go.id, dll)

CMS (per tenant via organisasi_id):
  ├── cms_berita            ← artikel berita
  ├── cms_kategori          ← kategori berita
  ├── cms_halaman           ← halaman statis
  ├── cms_galeri            ← album foto
  ├── cms_pengumuman
  ├── cms_slider
  ├── cms_menu
  ├── cms_seo               ← meta tag per halaman
  ├── cms_agenda            ← [belum ada]
  ├── cms_pejabat           ← [belum ada]
  └── cms_komentar          ← [belum ada]
```

---

## Komunikasi Backend ↔ Frontend Edge

Dua pilihan (bisa pakai keduanya):

### Opsi A — gRPC (sudah ada proto)
```
Backend CI4 → PHP gRPC client → Go Edge gRPC server
Proto: internal/grpcserver/gen/edge_sync.pb.go

Service EdgeSync:
  rpc SyncTenant(TenantConfig) returns (SyncResponse)
  rpc PublishContent(ContentPayload) returns (SyncResponse)
  rpc InvalidateDomain(DomainKey) returns (SyncResponse)
```

### Opsi B — HTTP Internal
```
Backend CI4 → HTTP POST → Go Edge internal endpoint
Endpoint: POST /internal/sync
Auth: API key di header X-Internal-Key
```

**Rekomendasi fase awal**: pakai HTTP internal dulu (lebih simpel), switch ke gRPC setelah stabil.

---

## Mode Deploy

| Aspek | Public (Cloud) | Private (On-Prem) |
|-------|---------------|-------------------|
| Cert SSL | Certbot/ACME otomatis | Cert internal PKI |
| DB | Managed (cloud) atau self-hosted | Wajib on-prem |
| Storage | Bisa S3 | Lokal/on-prem |
| Audit log | Opsional | Wajib, tidak bisa dinonaktifkan |
| IP restriction | Tidak | Opsional (whitelist jaringan pemerintah) |
| RBAC | Standard | Stricter (tambah IP binding) |

Kode aplikasi **sama persis** — beda hanya di `.env` dan konfigurasi deploy.
