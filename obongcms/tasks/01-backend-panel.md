# Backend – Panel (IAM, Tenant, Domain)
> Stack: CI4, PHP 8.4+, Twig 3, MySQL
> Path: `backend/pages/panel/`

## Auth Module
- [x] `Auth.php` controller — login, logout
- [x] OTP email flow — kirim kode, verifikasi, resend
- [x] Throttle login (rate limit per IP)
- [x] Views: form login, halaman OTP
- [ ] Remember device / remember me
- [ ] Session expiry handling (redirect ke login jika expired)

## User Module
- [~] `User.php` controller — list, tambah, edit, hapus user
- [~] `Profile.php` controller — edit profil sendiri
- [x] `ValProfile.php` model validasi
- [x] `ValUser.php` — validation model untuk admin kelola user
- [x] Views: list user, form tambah/edit, halaman profil
- [ ] Password reset by admin
- [ ] Upload foto profil

## Domain Module
- [x] `Domain.php` controller — CRUD domain/organisasi
- [x] `DomainModel.php`
- [x] Views: list domain, form tambah/edit
- [x] Status aktif/nonaktif domain
- [ ] Subdomain management (relasi ke tenant) — tipe field sudah ada (utama/redaksi/panel)

## Tenant Module
- [x] `Tenant.php` controller — CRUD tenant
- [x] `TenantModel.php` — include tema_id, wilayah_id
- [x] Views: list tenant, form tambah/edit
- [x] Field `tema_id` di form tambah/edit tenant — default value: `"default"`
- [x] Form edit tenant bisa ganti `tema_id`
- [x] Nonaktifkan / suspend tenant (soft delete)
- [ ] Provisioning flow: kirim sinyal `create_tenant` ke Go Edge (include tema_id)
- [ ] Sinyal `update_tenant` ke Go Edge saat edit tema_id
- [ ] Link tenant ke domain — sudah via DomainModel.tenant_id, tapi belum ada UI assign domain ke tenant di form tenant

## Wilayah Module
> `pages/panel/Wilayah/` — kelola wilayah provinsi & kabkota
- [x] Controller, Model, Views, Config/Routes
- [x] CRUD wilayah: nama, tipe (provinsi|kabkota), kode_wilayah, parent (kabkota → provinsi)
- [x] Views: list wilayah, form tambah/edit
- [x] Nonaktifkan wilayah (soft delete)

## Permission & Level
> 4 role, tidak bisa ditambah/dihapus dari UI — hardcoded di seed SQL

| Flag | Akses Panel | Akses Redaksi |
|------|------------|---------------|
| `DEV` | Semua | Semua tenant |
| `ADMIN_WILAYAH` | Terbatas wilayah | — |
| `ADMIN_TENANT` | — | Semua modul + manage user tenant |
| `REDAKSI` | — | Konten saja |

- [ ] Views: halaman info matrix permission (read-only, bukan form CRUD)
- [ ] Filter wilayah di semua query ADMIN_WILAYAH — join `app_users_wilayah` + `app_tenants.wilayah_id`
- [ ] Scope check: ADMIN_WILAYAH tidak bisa akses tenant di luar wilayahnya
- [ ] Mapping user wilayah: saat buat ADMIN_WILAYAH → assign ke 1+ wilayah

## Dashboard
- [x] `Dashboard.php` controller + widget statistik + API stats
- [x] Views: halaman dashboard dengan widget

## Pengaturan (Settings)
- [x] `Pengaturan.php` controller
- [x] `ValPengaturan.php`
- [x] Views: form key-value settings
- [ ] Kelompok setting (group by category)

## Audit Log
- [~] `Audit.php` controller — list + export route sudah ada
- [x] Views: tabel log
- [ ] Model untuk query audit log (AuditModel.php)
- [ ] Filter: user, tanggal, modul
- [ ] Export audit log ke Excel/CSV

## API — DomainResolver
- [~] `DomainResolver.php` controller — scaffolded
- [ ] Endpoint: `/api/domain/{domain}` → return config tenant
- [ ] Endpoint: `/api/content/{domain}/berita` → return JSON berita
- [ ] Endpoint: `/api/content/{domain}/halaman/{slug}`
- [ ] Endpoint: `/api/content/{domain}/menu`
- [ ] Auth API key untuk frontend edge
- [ ] Rate limiting API endpoint

## Testing & QA
- [ ] Cek permission check di semua controller method
- [ ] Cek CSRF di semua form POST
- [ ] Cek soft delete (deleted_at) berjalan benar
- [ ] Cek audit log tercatat di setiap operasi CRUD
