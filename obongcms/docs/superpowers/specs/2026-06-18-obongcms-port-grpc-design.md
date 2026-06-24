# Design: ObongCMS — Port dari AcehCMS v5 + gRPC Transport

**Tanggal:** 2026-06-18  
**Status:** Approved  
**Scope:** Full port CI3→CI4 backend + copy Go Edge + replace HTTP internal dengan gRPC murni

---

## 1. Latar Belakang

ObongCMS adalah re-branding dan re-platform dari AcehCMS v5:
- **Source:** `acehcms-v5/backend_be` (CI3 PHP) + `acehcms-v5/container` (Go, HTTP REST + SSH)
- **Target:** `ObongCMS/backend` (CI4 PHP 8.4) + `ObongCMS/frontend` (Go, gRPC murni)
- **Tambahan utama:** Komunikasi CI4 ↔ Go diganti dari HTTP REST + SSH → gRPC (protobuf)
- **Deployment:** Dev 1 server, staging/production 2 server terpisah

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│  SERVER 1 (CI4 Backend)                                  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  CI4 (PHP 8.4 + Nginx + PHP-FPM)                 │   │
│  │  panel.obongcms.local / redaksi.{domain}         │   │
│  │                                                  │   │
│  │  EdgeGrpc.php  ──── gRPC client ──────────────┐ │   │
│  │  Generator.php (build JSON snapshots)          │ │   │
│  └────────────────────────────────────────────────│─┘   │
│                                                   │      │
│                    gRPC :50051                    │      │
│                                                   │      │
│  ┌────────────────────────────────────────────────▼─┐   │
│  │  Go Edge (Chi v5)                                 │   │
│  │  HTTP :9090 (public) + gRPC :50051 (internal)    │   │
│  │                                                   │   │
│  │  internal/grpcserver/server.go                    │   │
│  │  runtime/public/tenants/{code}/                   │   │
│  │    ├── json/    ← snapshot konten                 │   │
│  │    └── media/   ← file upload                     │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Alur publish konten:**
1. Redaksi klik Publish di CI4
2. `Generator.php` query DB → build JSON array
3. `EdgeGrpc::syncSnapshot()` kirim via gRPC `SyncSnapshot` RPC
4. Go Edge tulis ke `runtime/public/tenants/{code}/json/{path}`
5. Request publik langsung baca dari filesystem

**Alur upload media:**
1. CI4 terima file upload dari redaksi
2. `EdgeGrpc::syncFile()` stream chunks via gRPC `SyncFile` RPC (client-streaming)
3. Go Edge tulis ke `runtime/public/tenants/{code}/media/{folder}/`
4. Return path relatif ke CI4

**HTTP `/api/internal/*` dihapus sepenuhnya** — tidak ada dual transport.

---

## 3. Proto Contract

File: `backend/proto/edge_sync.proto` (sudah ada, tidak berubah)

```protobuf
service EdgeSync {
  rpc SyncFile(stream FileChunk) returns (SyncResult);      // upload media (chunked)
  rpc SyncSnapshot(SnapshotPayload) returns (SyncResult);   // publish JSON konten
  rpc InvalidateCache(TenantKey) returns (Result);          // invalidate cache
  rpc SyncDomainConfig(DomainConfig) returns (Result);      // update config domain
}
```

Generated output:
- Go: `frontend/internal/grpcserver/gen/` (sudah ada `edge_sync.pb.go` + `edge_sync_grpc.pb.go`)
- PHP: `backend/proto/gen/` (perlu di-generate)

---

## 4. Backend CI4 — Modul

### 4.1 Mapping CI3 → CI4

| CI3 (source) | CI4 (target) | Status |
|---|---|---|
| `pages/manage/domain/` | `pages/panel/Tenant/` + `pages/panel/Domain/` | overwrite |
| `pages/manage/superadmin/` | `pages/panel/Wilayah/` + `pages/panel/Platform/` | overwrite |
| `pages/manage/redaksi/` | `pages/panel/User/` | overwrite |
| `pages/manage/aktivitas/` | `pages/panel/Audit/` | overwrite |
| `pages/manage/dashboard/` | `pages/panel/Dashboard/` | overwrite |
| `pages/manage/artikel/` | merge ke Tenant panel | overwrite |
| `pages/redaksi/berita/` | `pages/redaksi/Berita/` | overwrite |
| `pages/redaksi/galeri/` | `pages/redaksi/Galeri/` | overwrite |
| `pages/redaksi/halaman/` | `pages/redaksi/Halaman/` | overwrite |
| `pages/redaksi/agenda/` | `pages/redaksi/Agenda/` | baru |
| `pages/redaksi/pejabat/` | `pages/redaksi/Pejabat/` | baru |
| `pages/redaksi/komentar/` | `pages/redaksi/Komentar/` | baru |
| `pages/redaksi/tampilan/` | `pages/redaksi/Tampilan/` | overwrite |
| `pages/redaksi/seo/` | `pages/redaksi/Seo/` | overwrite |
| `pages/redaksi/pengguna/` | `pages/redaksi/User/` | overwrite |
| `pages/redaksi/manager/` | `pages/redaksi/Media/` | overwrite |
| `generator/*.php` | `base/Libraries/Generator.php` | extend/overwrite |
| `libraries/Frontend.php` | `base/Libraries/EdgeGrpc.php` | **replace total** |
| `libraries/Ssh.php` | ❌ hapus | tidak diport |
| `libraries/Beanstalkd.php` | ❌ hapus | tidak diport |

### 4.2 CI3 → CI4 Porting Rules

- `$this->load->model('X')` → `new X()` atau constructor injection
- `$this->db->query("SELECT...")` → CI4 Query Builder / prepared statements
- Views PHP (`.php`) → Twig (`.html`)
- `$this->load->library('X')` → `new X()` manual atau via `Services`
- `domain_id()` global CI3 helper → `session()->get('tenant_id')` dari filter CI4
- `$this->session->userdata('x')` → `session()->get('x')`
- CI3 `MY_Controller` → CI4 `BaseController`
- Validation `$this->form_validation` → CI4 `ValModuleName` class dengan field DSL

### 4.3 EdgeGrpc.php (ganti GoEdge.php)

```php
namespace Base\Libraries;

class EdgeGrpc {
    // gRPC channel ke Go Edge (:50051)
    public function syncSnapshot(string $tenantCode, string $jsonPath, string $content): bool
    public function syncFile(string $tenantCode, string $filePath, UploadedFile $file): ?string
    public function invalidateCache(string $tenantCode): bool
    public function syncDomainConfig(string $tenantCode, array $config): bool
}
```

Dependency composer: `grpc/grpc` + `google/protobuf`  
PHP stubs di-generate ke `backend/proto/gen/`

### 4.4 Branding

Semua referensi `acehcms` / `AcehCMS` / `acehprov` → `obongcms` / `ObongCMS` / `obong`:
- Namespace, env var names, URL defaults, log prefix, class names, config keys

---

## 5. Go Edge — Porting + gRPC Server

### 5.1 Mapping acehcms container → ObongCMS frontend

| acehcms container | ObongCMS frontend | Keterangan |
|---|---|---|
| `core/syncron/` | ❌ hapus | diganti gRPC server |
| `core/response/` | `modules/site/response/` | port + rebrand |
| `core/request/` | `internal/domainresolver/` | merge + extend |
| `core/render/` | `base/views/` | sudah ada, extend |
| `core/session/` | `base/middleware/auth.go` | port |
| `core/comment/` | `modules/site/comment/` | port |
| `core/helper/` | `base/helpers/` | port |
| `core/telegram/` | `base/helpers/telegram.go` | port |
| `core/repository/` | `internal/models/` | port |
| `contents/themes/` | `templates/` | port + rebrand |
| `contents/plugins/` | `templates/plugins/` | port |
| `acehcms.go` | `main.go` | overwrite + gRPC start |

### 5.2 gRPC Server Implementation

File baru: `frontend/internal/grpcserver/server.go`

```go
type EdgeSyncServer struct {
    edgesync.UnimplementedEdgeSyncServer
    runtimePath string       // path ke runtime/public/tenants/
    cache        PublishCache // interface ke publishcache
    resolver     DomainResolver
}

func (s *EdgeSyncServer) SyncSnapshot(ctx, payload) → tulis JSON ke tenant/json/
func (s *EdgeSyncServer) SyncFile(stream)           → terima chunks, tulis ke tenant/media/
func (s *EdgeSyncServer) InvalidateCache(ctx, key)  → flush cache tenant tertentu
func (s *EdgeSyncServer) SyncDomainConfig(ctx, cfg) → update domain config + reload resolver
```

File baru: `frontend/internal/grpcserver/interceptor.go`

```go
// Unary + stream interceptor: validasi metadata "x-grpc-secret" == env GRPC_SECRET
func AuthInterceptor(secret string) grpc.UnaryServerInterceptor
func AuthStreamInterceptor(secret string) grpc.StreamServerInterceptor
```

### 5.3 main.go — Dual Server

```go
// Jalankan konkuren:
// 1. Chi HTTP server di :APP_PORT (default 9090)
// 2. gRPC server di :GRPC_PORT (default 50051)
// Graceful shutdown keduanya saat SIGINT/SIGTERM
```

---

## 6. Environment Variables

### `backend/.env`

```
GRPC_HOST=localhost:50051      # dev: localhost, prod: <ip-server-go>:50051
GRPC_SECRET=obong_grpc_secret_2026
```

Variabel dihapus (tidak lagi digunakan):
```
GOEDGE_URL
GOEDGE_SECRET
```

### `frontend/.env`

```
APP_PORT=9090
GRPC_PORT=50051
GRPC_SECRET=obong_grpc_secret_2026   # harus sama persis dengan backend
RUNTIME_PATH=./runtime
```

Variabel dihapus:
```
GOEDGE_SECRET
BACKEND_URL
BACKEND_API_KEY
```

---

## 7. Makefile Targets (frontend/)

Tambah targets:
```makefile
proto-go:
    protoc --go_out=. --go-grpc_out=. \
        --go_opt=paths=source_relative \
        --go-grpc_opt=paths=source_relative \
        ../backend/proto/edge_sync.proto

proto-php:
    protoc --php_out=../backend/proto/gen \
        --grpc_out=../backend/proto/gen \
        --plugin=protoc-gen-grpc=$(which grpc_php_plugin) \
        ../backend/proto/edge_sync.proto
```

---

## 8. Port Summary

| Port | Service | Akses |
|---|---|---|
| 9090 | Go Edge HTTP (Chi) | Public via Nginx |
| 50051 | Go Edge gRPC | Internal only (CI4 → Go, firewall restricted) |
| 80/443 | Nginx | Public |

Dev: CI4 connect langsung ke `localhost:50051` (tanpa Nginx proxy).  
Production: firewall server Go hanya izinkan port 50051 dari IP server CI4.

---

## 9. Urutan Implementasi (high-level)

1. **Go Edge: port dari acehcms container** (response, request, render, session, comment, helper, telegram, repository, themes, plugins)
2. **Go Edge: implement gRPC server** (server.go + interceptor.go + main.go dual-server)
3. **Backend: generate PHP proto stubs** (`backend/proto/gen/`)
4. **Backend: implement EdgeGrpc.php** (gRPC client, ganti GoEdge.php)
5. **Backend: port semua modul CI3 → CI4** (panel + redaksi, modul per modul)
6. **Backend: Generator.php** (extend untuk semua tipe konten dari acehcms)
7. **Integration test:** publish berita end-to-end (CI4 → gRPC → Go Edge → serve publik)
8. **Rebrand:** ganti semua referensi acehcms/acehprov → obongcms/obong

---

## 10. Yang Tidak Diport

- `libraries/Ssh.php` — SSH direct write dihapus, diganti gRPC
- `libraries/Beanstalkd.php` — queue via Beanstalkd dihapus
- `pages/redaksi/changelog/`, `development/`, `panduan/` — internal tool acehcms, tidak relevan
- CI3-specific: `core/MY_Controller.php`, `hooks/`, `third_party/cool-php-captcha`
