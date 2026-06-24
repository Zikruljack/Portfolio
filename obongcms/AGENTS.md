# AGENTS.md — ObongCMS

## Arsitektur

Dua service, komunikasi via HTTP internal:

| Service | Stack | URL lokal | Folder |
|---------|-------|-----------|--------|
| Backend (panel + redaksi + API) | CI4 / PHP 8.4 + Nginx | `http://panel.obongcms.local` | `backend/` |
| Go Edge (renderer publik) | Go + Chi v5 | `http://{domain}.local` | `frontend/` |

CI4 **tidak pernah** menulis ke filesystem Go Edge. CI4 kirim payload JSON ke endpoint `/api/internal/*` di Go Edge via Nginx proxy.

---

## Cara Menjalankan (WSL Nginx — bukan Docker)

### 1. Symlink nginx configs (sekali saja)

```bash
sudo ln -sf /home/obong/Codes/project_codes/ObongCMS/backend/nginx/panel.obongcms.local.conf    /etc/nginx/sites-enabled/
sudo ln -sf /home/obong/Codes/project_codes/ObongCMS/backend/nginx/redaksi.obongcms.local.conf  /etc/nginx/sites-enabled/
sudo ln -sf /home/obong/Codes/project_codes/ObongCMS/backend/nginx/edge.obongcms.local.conf     /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

### 2. /etc/hosts (sekali saja, tambah per tenant baru)

```
127.0.0.1  panel.obongcms.local
127.0.0.1  obongcms.local
# Tambah tiap tenant baru:
127.0.0.1  demo.local
127.0.0.1  redaksi.demo.local
```

### 3. Jalankan PHP-FPM

```bash
sudo service php8.4-fpm start
# atau
sudo php-fpm8.4 -D
```

CI4 tersedia di: `http://panel.obongcms.local`
Panel admin: `http://panel.obongcms.local/panel/auth`

> Tidak ada `spark` — CI4 dijalankan via Nginx + PHP-FPM langsung ke folder `backend/public`.

### 4. Jalankan Go Edge

```bash
cd frontend
make dev        # hot-reload dengan air
# ATAU
go run main.go
```

Go Edge berjalan di port **9090**, Nginx proxy ke sana untuk semua domain `*.local` (kecuali `panel.*` dan `redaksi.*`).

Health check: `curl http://obongcms.local/health`

---

## URL Routing — PENTING

### Multi-tenant via subdomain `.local`

| URL | Keterangan |
|-----|------------|
| `http://panel.obongcms.local` | Panel admin CI4 (DEV/superadmin) |
| `http://redaksi.demo.local` | CMS redaksi CI4 untuk tenant `demo` |
| `http://demo.local` | Situs publik tenant `demo` (Go Edge) |
| `http://demo.local/berita` | Daftar berita |
| `http://demo.local/berita/{slug}` | Detail berita |

Go Edge resolve domain dari `Host` header yang dikirim Nginx (`proxy_set_header Host $host`).

### Test curl langsung ke Go Edge (bypass Nginx)

```bash
# Pakai -H "Host:" karena bypass Nginx
curl -H "Host: demo.local" http://localhost:9090/berita
curl -H "Host: demo.local" http://localhost:9090/berita/slug-berita

# Via Nginx (tidak perlu Host header)
curl http://demo.local/berita
```

---

## Internal API (CI4 → Go Edge)

```bash
# Publish konten
curl -X POST http://localhost:9090/api/internal/publish \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: obong_internal_secret_2026" \
  -d '{"action":"publish_content","domain":"demo.local","files":[
    {"path":"berita.json","content":"..."},
    {"path":"berita/slug.json","content":"..."}
  ]}'

# Buat tenant baru
curl -X POST http://localhost:9090/api/internal/tenant \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: obong_internal_secret_2026" \
  -d '{"action":"create_tenant","domain":"demo.local","setting":{"tema_id":"default"}}'

# Upload media
curl -X POST http://localhost:9090/api/internal/media/upload \
  -H "X-Internal-Secret: obong_internal_secret_2026" \
  -F "domain=demo.local" -F "folder=berita" -F "file=@foto.jpg"
```

## Backend CI4 API (Go Edge → CI4)

```bash
curl -H "X-API-Key: obong_api_key_2026" http://panel.obongcms.local/api/domain/demo.local
curl -H "X-API-Key: obong_api_key_2026" http://panel.obongcms.local/api/content/demo.local/berita
```

---

## Environment Variables

### `backend/.env`

```
GOEDGE_URL=http://localhost:9090
GOEDGE_SECRET=obong_internal_secret_2026
API_KEY=obong_api_key_2026
```

### `frontend/.env`

```
APP_PORT=9090
RUNTIME_PATH=./runtime
GOEDGE_SECRET=obong_internal_secret_2026
BACKEND_URL=http://panel.obongcms.local
BACKEND_API_KEY=obong_api_key_2026
```

> `GOEDGE_SECRET` harus sama persis di kedua file.

---

## Tambah Tenant Baru

1. Buat tenant + domain di panel CI4 → otomatis trigger `create_tenant` ke Go Edge
2. Tambah `/etc/hosts`:
   ```
   127.0.0.1  namatenant.local
   127.0.0.1  redaksi.namatenant.local
   ```
3. Login redaksi → buat berita → Publish → muncul di `http://namatenant.local/berita`

---

## Nginx Configs

| File | Fungsi |
|------|--------|
| `backend/nginx/panel.obongcms.local.conf` | CI4 panel (`panel.obongcms.local`) |
| `backend/nginx/redaksi.obongcms.local.conf` | CI4 redaksi wildcard (`redaksi.*.local`) |
| `backend/nginx/edge.obongcms.local.conf` | Go Edge proxy wildcard (`*.local`) |

## Keamanan

Sebelum deploy produksi, baca dan audit **`SECURITY.md`** di root project.  
Selama MVP: fokus bisnis logic, tapi tetap jaga isolasi tenant dan tidak ada SQL injection.

---

## Referensi Kode

| Komponen | Path |
|----------|------|
| Go Edge entrypoint | `frontend/main.go` |
| Internal API handler | `frontend/modules/internalapi/handler.go` |
| Site handler | `frontend/modules/site/handler.go` |
| Tenant filesystem | `frontend/internal/tenantfs/tenantfs.go` |
| Domain resolver | `frontend/internal/domainresolver/domainresolver.go` |
| CI4 Berita controller | `backend/pages/redaksi/Berita/Controllers/Berita.php` |
| GoEdge library (CI4 side) | `backend/base/Libraries/GoEdge.php` |
