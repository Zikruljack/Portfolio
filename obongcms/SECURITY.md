# SECURITY.md — ObongCMS

> **Kapan dibaca:** Setelah MVP berjalan dan sebelum deploy ke produksi.  
> **Untuk apa:** Checklist keamanan yang harus diaudit dan diperbaiki sebelum go-live.

---

## STATUS

- [ ] Audit belum dilakukan (tahap MVP)
- [ ] Tandai setiap item `[x]` setelah diverifikasi atau diperbaiki

---

## 1. Multi-Tenant Isolation (KRITIS)

Kebocoran data antar tenant adalah risiko paling serius.

- [ ] Semua query di modul Redaksi wajib filter `WHERE tenant_id = ?` — tidak ada pengecualian
- [ ] Controller Redaksi wajib ambil `tenant_id` dari session, **bukan dari request parameter**
- [ ] Validasi: user yang login di `redaksi.a.com` tidak bisa akses data `redaksi.b.com`
- [ ] Go Edge: path `runtime/public/tenants/{domain}/` hanya boleh diakses dengan domain yang sudah divalidasi dari `Host` header — tidak bisa di-inject via URL parameter
- [ ] Theme API Go Edge: `{domain}` di URL wajib divalidasi — hanya boleh domain yang terdaftar di system

---

## 2. Autentikasi & Otorisasi

- [ ] Permission check wajib di **setiap** controller method — tidak ada method yang bypass
- [ ] OTP email: rate limit pengiriman OTP (max 3x per 10 menit per email)
- [ ] Session invalidasi saat logout — tidak cukup hapus cookie saja, hapus juga dari server
- [ ] Session timeout: set `session.expiration` di CI4 config (rekomendasi: 2 jam idle)
- [ ] Password hash: wajib `password_hash()` dengan `PASSWORD_BCRYPT` — tidak boleh MD5/SHA1
- [ ] Superadmin (DEV) tidak bisa login via halaman redaksi tenant — endpoint terpisah

---

## 3. Internal API (CI4 ↔ Go Edge)

- [ ] `X-Internal-Secret` wajib divalidasi di **semua** endpoint `/api/internal/*` dan `/internal/*` Go Edge
- [ ] Secret production berbeda dari development (`obong_internal_secret_2026` tidak boleh dipakai di produksi)
- [ ] Internal API hanya accessible dari localhost/private network — **tidak boleh expose ke internet**
- [ ] Go Edge: validasi method HTTP — endpoint yang hanya butuh POST tidak boleh terima GET
- [ ] Log semua request internal API yang gagal autentikasi

---

## 4. Path Traversal (Theme System)

Tema editor memungkinkan user menulis file ke disk — area berisiko tinggi.

- [ ] Go Edge theme file API: validasi `path` parameter — strip `../`, tidak boleh keluar dari folder tema
- [ ] Whitelist ekstensi file yang boleh diedit: `.html`, `.css`, `.js` saja
- [ ] Upload asset tema: whitelist MIME type (`image/jpeg`, `image/png`, `image/webp`, `text/css`, `application/javascript`)
- [ ] Upload asset tema: batasi ukuran file (rekomendasi: max 2MB per file)
- [ ] Nama file upload: sanitasi — hapus karakter selain `[a-zA-Z0-9._-]`
- [ ] Nama tema baru (duplicate): validasi — hanya huruf, angka, dan strip/underscore

---

## 5. SQL Injection

- [ ] Semua query CI4 pakai Query Builder atau parameterized query — tidak ada string concatenation langsung
- [ ] Cari dan audit: `$db->query("... $variable ...")` — harus diganti
- [ ] Input pencarian (search): wajib di-escape via Query Builder `like()` method

---

## 6. XSS (Cross-Site Scripting)

- [ ] Twig auto-escape aktif untuk semua output (default Twig sudah escape)
- [ ] `safeHTML` / `{{ var|raw }}` di Twig: **hanya** boleh dipakai untuk konten yang sudah melalui HTML sanitizer (strip script tags, etc.)
- [ ] Go Edge `safeHTML` FuncMap: verifikasi konten yang di-render sudah bersih (output dari CI4 rich text editor)
- [ ] User input yang ditampilkan kembali (nama, tagline, dll): pastikan di-escape

---

## 7. CSRF

- [ ] CI4 CSRF protection aktif di semua form POST (`Config/Security.php`)
- [ ] API endpoint yang menerima request dari browser: wajib pakai CSRF token atau SameSite cookie

---

## 8. File & Media Upload

- [ ] Validasi tipe file di server (bukan hanya client-side) — cek MIME type sungguhan, bukan ekstensi
- [ ] File yang diupload **tidak boleh** bisa dieksekusi sebagai PHP — simpan di luar `public/` atau konfigurasi Nginx untuk blok eksekusi PHP di folder upload
- [ ] Rename file saat upload — jangan simpan dengan nama asli dari user
- [ ] Batas ukuran file upload global di Nginx config dan PHP `upload_max_filesize`

---

## 9. Secret & Konfigurasi Produksi

- [ ] `.env` tidak masuk git (sudah di `.gitignore` — verifikasi)
- [ ] Ganti semua secret dev ke nilai unik produksi:
  - `GOEDGE_SECRET` — generate random 32+ karakter
  - `API_KEY` — generate random 32+ karakter
- [ ] `CI_ENVIRONMENT=production` di `.env` produksi — matikan debug output
- [ ] Database password: tidak pakai password default
- [ ] Go Edge: tidak log konten request body di produksi

---

## 10. Nginx & Infrastruktur

- [ ] Semua traffic produksi wajib HTTPS — redirect HTTP ke HTTPS
- [ ] Header keamanan di Nginx:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security` (HSTS)
- [ ] Internal API Go Edge (`/api/internal/*`, `/internal/*`): block dari internet, hanya izinkan dari IP internal
- [ ] Nonaktifkan direktori listing di Nginx
- [ ] PHP error display: `display_errors = Off` di produksi

---

## 11. Audit Log

- [ ] Semua aksi login/logout tercatat di `app_activity`
- [ ] Aksi kritis (hapus berita, ubah domain, hapus tema, aktivasi tema) wajib masuk audit log
- [ ] Log tidak bisa dihapus oleh admin biasa — hanya DEV

---

## Referensi

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CI4 Security Guide: https://codeigniter.com/user_guide/concepts/security.html
- Laporan vulnerability: buat issue di repo dengan label `security` (jangan expose publik)
