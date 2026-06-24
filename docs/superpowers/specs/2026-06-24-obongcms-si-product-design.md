# ObongCMS + SI Product Design

Date: 2026-06-24
Status: Draft

## Products

### ObongCMS
Multi-tenant CMS platform SaaS (WordPress.com-style). CI4 backend (panel) + Go Edge (public renderer).

- **Free**: subdomain.obongcms.com, 1 admin, basic theme, CMS standar
- **Paid**: custom domain, unlimited admin, premium themes + CSS custom
- **Plugins**: paid per tenant (permanent), dual-layer (backend + frontend)
- **Self-hosted**: opsional (jual codebase dengan lisensi)

### SI (Sistem Informasi)
Sekolah/pesantren management system. Dual model:
- **Self-hosted (one-time)**: kirim codebase + dokumentasi, client handle deployment
- **Managed (SaaS - future)**: lo host-in, bayar bulanan
- **Customization**: lo setup + modify sesuai kebutuhan (biaya terpisah)

## Arsitektur ObongCMS

### Plugin System (Dual-layer)

#### Backend Plugin (CI4)
- Composer package dari private repository
- Manifest: `plugin.json` (nama, versi, hooks, permissions)
- Hook points: `onMenuAdd()`, `onDashboardWidget()`, `onContentSave()`, `onSettings()`
- DB tables: prefix `plugin_{nama}_`
- Panel UI muncul di sidebar admin tenant
- Feature flag per tenant (plugin aktif/nonaktif)

#### Frontend Plugin (Go Edge)
- Compiled Go module
- Route injection (publik endpoint)
- Widget injection (sidebar, footer, homepage)
- Template function extension
- Feature flag dari `tenant.json`
- No DB access — cuma baca dari JSON filesystem

#### Plugin Lifecycle
```
Dev push → composer require (backend) + compile (frontend)
  → Superadmin panel: set price + publish
  → Tenant panel: browse → buy
  → tenant.json: {"plugins": {"form-builder": true}}
  → Kedua sisi baca flag ini
```

No runtime sandbox — hanya Obong sendiri yang develop plugin. SDK untuk third-party nanti jika diperlukan.

### Theme System (Go Edge)

```
templates/
├── default/            → Tema bawaan (free)
│   ├── theme.json      → Manifest: nama, screenshot, author, tier, features
│   ├── base.html       → Layout utama
│   ├── index.html      → Homepage
│   ├── berita/         → index.html + detail.html
│   ├── halaman/        → detail.html
│   ├── pengumuman/     → index.html + detail.html
│   └── partials/       → header.html, footer.html, sidebar.html
├── premium-1/          → Tema premium (berbayar)
└── custom-{tenant}/    → Custom theme per client (opsional)
```

- `tenant.json` → `theme: "default"`
- Fallback: cari tema aktif → fallback ke `default/` jika file tidak ada
- Admin tenant ganti tema via panel
- Custom CSS → disimpan di `setting.json`
- Custom header/footer HTML → disimpan di `setting.json`
- Push via code (superadmin tidak upload via panel)
- Template pure HTML/CSS/JS — tidak ada business logic

### Widget System (Free, bukan Plugin)

Layout blocks — drag & drop di sidebar/footer/homepage.

**Posisi**: sidebar, footer, homepage_top, homepage_bottom

**Tipe blok**:
- HTML Custom, Berita Terbaru, Halaman, Kategori, Tag, Arsip
- Galeri, Menu, Sosial Media, Jam, Kalender
- Pencarian, Statistik, Jam Digital

**Output widget_layout.json**: array blok per posisi dengan konfigurasi.

Render: template `{{range .Widgets.sidebar}}` → partial sesuai type.

### Tema vs Widget vs Plugin

| Layer | Tujuan | Harga |
|-------|--------|-------|
| **Tema** | Tampilan visual website | Free / Premium |
| **Widget** | Tata letak konten di posisi tertentu | Free (selamanya) |
| **Plugin** | Fitur baru (form, chat, SEO, dll) | Berbayar |

## Arsitektur SI

### Base: dayah-dda (sudah production)
- CI4 dengan custom framework `base/` (sama dengan ObongCMS backend)
- Twig 3, Bootstrap/Metronic, DataTables, AJAX SPA
- Multi-user + RBAC
- OTP 2FA, audit log, encrypted IDs

### Modules (dari dayah-dda)
- **Akademik**: Jadwal, Kelas, Mapel, Nilai, Raport, Tahun Ajaran
- **Kesiswaan**: Santri/Siswa, Absensi
- **Kepegawaian**: Guru/Staf, Administrasi (SK, payroll)
- **CMS**: Berita, Halaman, Galeri, Menu, Slider, Pengumuman, SEO
- **Keuangan**: Pembayaran/SPP

### Target Market
- Sekolah
- Pesantren
- Yayasan Pendidikan

### Self-hosted Package
- Codebase CI4 + dokumentasi
- Installer script
- Deployment guide
- Opsi: lo deploy (biaya terpisah) atau client handle sendiri

## Deployment Roadmap

### Fase 1: Single VPS ($10-20/bln)
```
Nginx (public)
  → Go Edge (:9090 internal) → JSON filesystem
  → CI4 Panel (:8080 internal) → MySQL
1 VPS, semua di satu box.
```

### Fase 2: Scale (50-500+ tenant)
- Pisah Go Edge ke server sendiri
- Redis cache
- Shared filesystem (NFS/S3)
- Horizontal scaling Go Edge (stateless → mudah)

## Payment Integration
- **Stripe** — global
- **Midtrans** — Indonesia

## Roadmap Pembangunan

### Phase 1: ObongCMS Core Completion
- [ ] Go Edge render semua content type (halaman, galeri, slider, pengumuman)
- [ ] Theme system (template switching + fallback)
- [ ] Widget system (panel + render)
- [ ] Admin panel: theme selector, widget manager, custom CSS/HTML

### Phase 2: Plugin Infrastructure
- [ ] Plugin manifest + registry (CI4)
- [ ] Feature flags per tenant
- [ ] Plugin engine (Go Edge — route + widget injection)
- [ ] 1-2 reference plugins

### Phase 3: Billing & Marketplace
- [ ] Stripe integration
- [ ] Midtrans integration
- [ ] Plugin marketplace panel
- [ ] Tier management (free vs paid)

### Phase 4: SI Product Packaging
- [ ] Generalize dayah-dda → SI Sekolah (configurable branding, non-pesantren mode)
- [ ] Self-hosted package + docs
- [ ] SI landing page + pricelist di portfolio
