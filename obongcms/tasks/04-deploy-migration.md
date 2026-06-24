# Deploy & Migrasi Legacy
> Dua mode deploy: Public (shared cloud) dan Private (on-prem pemerintahan)

---

## A. Deploy – Public (Cloud)

### Struktur Folder
- [ ] Buat `deploy/public/` dengan `docker-compose.yml`
- [ ] Backend service: PHP-FPM + Nginx
- [ ] Frontend service: Go binary + Nginx
- [ ] DB service: MySQL (atau gunakan managed DB)
- [ ] Volume: `uploads/`, `runtime/public/tenants/`

### Konfigurasi
- [ ] `.env.example` untuk public deploy
- [ ] Nginx config: virtual host multi-domain → Go edge
- [ ] Nginx config: backend panel + API (subdomain admin)
- [ ] SSL/TLS: certbot auto atau manual cert mount
- [ ] Firewall rule: DB tidak expose ke publik

### CI/CD (opsional fase awal)
- [ ] GitHub Actions: build Go binary
- [ ] GitHub Actions: run tests
- [ ] Deploy script (rsync/ssh atau Docker push)

---

## B. Deploy – Private / Government (On-Prem)

### Perbedaan dari Public
- [ ] Tidak ada certbot (gunakan cert internal PKI)
- [ ] DB wajib on-prem (tidak boleh managed cloud)
- [ ] Storage lokal (tidak boleh S3 publik)
- [ ] Audit log wajib (tidak bisa dinonaktifkan)
- [ ] IP restriction opsional (whitelist jaringan pemerintah)

### Struktur Folder
- [ ] Buat `deploy/private/` dengan `docker-compose.yml` terpisah
- [ ] Override env profile untuk private

### Installer / Setup Guide
- [ ] Script `install.sh` — setup awal: DB, folder, seed data
- [ ] Docs: `docs/deploy-private.md` — langkah instalasi on-prem
- [ ] Backup policy: cron backup DB + folder upload

---

## C. Database – Finalisasi Schema

### Schema Baru
- [ ] Review `database/sql/01_platform.sql` — complete atau perlu tambahan?
- [ ] Review `database/sql/02_content.sql` — semua tabel CMS sudah ada?
- [ ] Tambah tabel yang missing: `agenda`, `pejabat`, `komentar`, `media`
- [ ] Tambah `organisasi_id` di semua tabel CMS (multi-tenant)
- [ ] Test: fresh install dari `init.sql` berjalan tanpa error

### Seed Data
- [ ] Seed: `main_anggota_level` (DEV, ADMIN, REDAKSI)
- [ ] Seed: `main_anggota` admin default
- [ ] Seed: `app_modules` — daftar semua module.action
- [ ] Seed: `app_permissions` — mapping default DEV (full), ADMIN (operasional), REDAKSI (CMS only)
- [ ] Seed: 1 domain + 1 tenant contoh

---

## D. Migrasi Legacy (acehcms-v5)

> Rencana detail ada di `backend/docs/legacy-db-merge-plan.md`

### Fase Migrasi
- [ ] **Export** data legacy dari `acehcms_bukti1.sql` ke format CSV/JSON per tabel
- [ ] **Mapping** kolom lama → kolom baru (lihat `docs/legacy-table-mapping.md`)
- [ ] **Script import**: konversi + insert ke schema baru
  - [ ] IAM: `acl_manage`, `acl_pengguna` → `pengguna`
  - [ ] Domain: `acl_backend`, `acl_domain` → `domain`, `tenant`
  - [ ] CMS: berita, halaman, galeri, agenda, pejabat
  - [ ] SEO, menu, slider per domain
- [ ] **Validasi**: hitung jumlah record sebelum dan sesudah import
- [ ] **Rollback plan**: backup schema baru sebelum import, script rollback

### Cutover
- [ ] Tenant baru masuk ke vNext, tenant lama masih bisa akses legacy (read-only)
- [ ] Verifikasi frontend vNext bisa serve semua domain yang sudah dimigrasi
- [ ] Legacy CI3 dijadikan read-only lalu dimatikan (Fase 8 blueprint)

---

## E. Monitoring & Hardening (Post-Deploy)

- [ ] Logging terpusat (minimal: error log ke file, bisa tambah ELK/Loki nanti)
- [ ] Health check endpoint: `GET /health` di backend dan frontend edge
- [ ] Uptime monitoring (UptimeRobot atau self-hosted)
- [ ] Security hardening checklist:
  - [ ] Header: CSP, HSTS, X-Frame-Options
  - [ ] Backend: tidak ada debug mode di production
  - [ ] DB: user DB hanya punya privilege yang diperlukan
  - [ ] File permission: `uploads/` tidak executable
