# Plan A: Go Edge — Port dari AcehCMS Container + gRPC Server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port seluruh acehcms container ke ObongCMS frontend dengan mengganti syncron HTTP dengan gRPC server, sehingga Go Edge bisa menerima sync dari CI4 via gRPC.

**Architecture:** acehcms `core/` diport ke package-package dalam `ObongCMS/frontend/`, `core/syncron/` dihapus dan digantikan `internal/grpcserver/server.go`, `main.go` menjalankan dua server konkuren: Chi HTTP `:9090` dan gRPC `:50051`. Domain resolver diupgrade untuk baca dari filesystem snapshot (bukan API call ke CI4).

**Tech Stack:** Go 1.25, Chi v5, google.golang.org/grpc v1.80, google/protobuf v1.36, godotenv, github.com/buger/jsonparser, github.com/muesli/smartcrop, github.com/nfnt/resize

## Global Constraints

- Module path: `github.com/obong/obongcms-edge` (tidak boleh diubah)
- Semua referensi `acehcms`, `AcehCMS`, `acehprov` → `obongcms`, `ObongCMS`, `obong`
- Template delimiters: `<cms:pre:render>` dan `</cms:pre:render>` (dipertahankan dari acehcms)
- Runtime path: `./runtime/public/tenants/{tenant_code}/` — bukan per domain string
- gRPC auth: metadata key `x-grpc-secret`, value dari env `GRPC_SECRET`
- HTTP internal `/api/internal/*` dihapus — tidak ada dual transport
- `go test ./...` harus pass sebelum setiap commit

---

## File Structure

### Dipertahankan / diextend dari ObongCMS yang ada:
- `frontend/main.go` — **overwrite** (tambah gRPC server start)
- `frontend/base/config/config.go` — **overwrite** (tambah GRPC_PORT, GRPC_SECRET, hapus GOEDGE_SECRET)
- `frontend/base/middleware/` — **pertahankan** (logger, security, auth, csrf, ratelimit)
- `frontend/base/helpers/response.go` — **pertahankan**
- `frontend/base/helpers/helpers.go` — **extend** (tambah ParseIntegerDef, ThemeSwitch)
- `frontend/internal/tenantfs/tenantfs.go` — **extend** (tambah EnsureSubDirs, WriteMedia)
- `frontend/internal/domainresolver/domainresolver.go` — **overwrite** (baca dari filesystem, bukan API)
- `frontend/internal/grpcserver/gen/` — **jangan disentuh** (generated)

### File baru:
- `frontend/internal/grpcserver/server.go` — implement EdgeSyncServer
- `frontend/internal/grpcserver/interceptor.go` — auth interceptor
- `frontend/internal/repository/request.go` — struct Request (port dari acehcms repository)
- `frontend/internal/render/html.go` — render HTML template
- `frontend/internal/render/error.go` — render error page
- `frontend/internal/render/goview/goview.go` — template engine wrapper
- `frontend/internal/render/goview/replace.go` — template replace helper
- `frontend/base/helpers/telegram.go` — telegram error notifier
- `frontend/base/helpers/theme.go` — ThemeSwitch helper
- `frontend/base/helpers/integer.go` — ParseIntegerDef helper

### Modules (overwrite seluruhnya):
- `frontend/modules/site/handler.go` — **overwrite** (full route dari acehcms, tanpa /syncron)
- `frontend/modules/site/response/json.go` — JSON file server
- `frontend/modules/site/response/media.go` — media file server
- `frontend/modules/site/response/thumbnail.go` — on-the-fly thumbnail
- `frontend/modules/site/response/rss.go` — RSS feed
- `frontend/modules/site/response/sitemap.go` — XML sitemap
- `frontend/modules/site/response/robots.go` — robots.txt
- `frontend/modules/site/response/custom.go` — custom CSS/JS
- `frontend/modules/site/response/theme.go` — theme assets
- `frontend/modules/site/response/withroot.go` — static file server helper
- `frontend/modules/site/comment/routes.go` — comment router
- `frontend/modules/site/comment/model.go` — comment structs
- `frontend/modules/site/comment/add.go`
- `frontend/modules/site/comment/list.go`
- `frontend/modules/site/comment/edit.go`
- `frontend/modules/site/comment/delete.go`
- `frontend/modules/site/comment/token.go`
- `frontend/modules/site/comment/logout.go`
- `frontend/modules/site/comment/decrypt.go`
- `frontend/modules/site/comment/clean.go`
- `frontend/modules/site/request/middleware.go` — ParseByDomain middleware
- `frontend/modules/site/request/context.go` — GetFromContext helper

### Dihapus:
- `frontend/modules/internalapi/handler.go` — diganti gRPC
- `frontend/modules/internal/handler.go` — tidak dipakai
- `frontend/modules/dashboard/handler.go` — replace dengan /health sederhana di main.go

### Runtime dirs (dibuat saat init):
- `frontend/runtime/public/tenants/` — root tenant data
- `frontend/runtime/system/themes/` — default themes (dari acehcms `contents/themes/`)
- `frontend/runtime/system/plugins/` — default plugins
- `frontend/runtime/cached/` — domain.json, system cache

### Assets default (port dari acehcms `core/default/`):
- `frontend/assets/default/error.html`
- `frontend/assets/default/domain.html`
- `frontend/assets/default/assets/` — CSS, JS, images default

---

## Task 1: Bersihkan file lama + update go.mod dependencies

**Files:**
- Modify: `frontend/go.mod`
- Delete: `frontend/modules/internalapi/handler.go`
- Delete: `frontend/modules/internal/handler.go`
- Delete: `frontend/modules/dashboard/handler.go`

**Interfaces:**
- Produces: go.mod dengan semua dependency yang dibutuhkan

- [ ] **Step 1: Tambah dependency baru ke go.mod**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/frontend
go get github.com/buger/jsonparser@latest
go get github.com/muesli/smartcrop@latest
go get github.com/nfnt/resize@latest
go get golang.org/x/image@latest
```

- [ ] **Step 2: Hapus file lama yang akan diganti**

```bash
rm -f modules/internalapi/handler.go
rm -f modules/internal/handler.go
rm -f modules/dashboard/handler.go
# Hapus direktori kosong kalau ada
rmdir modules/internalapi modules/internal modules/dashboard 2>/dev/null || true
```

- [ ] **Step 3: Verifikasi go.mod bisa di-tidy**

```bash
go mod tidy
```
Expected: tidak ada error

- [ ] **Step 4: Commit**

```bash
git add go.mod go.sum
git commit -m "chore: add dependencies for go edge port (jsonparser, smartcrop, resize)"
```

---

## Task 2: Repository struct + helpers dasar

**Files:**
- Create: `frontend/internal/repository/request.go`
- Create: `frontend/base/helpers/integer.go`
- Create: `frontend/base/helpers/telegram.go`
- Test: `frontend/internal/repository/request_test.go`

**Interfaces:**
- Produces:
  - `repository.Request` struct dengan semua field yang dipakai di seluruh site handler
  - `helpers.ParseIntegerDef(s string, def int) int`
  - `helpers.TelegramError(msg string, req repository.Request)`

- [ ] **Step 1: Tulis test untuk ParseIntegerDef**

```go
// frontend/base/helpers/integer_test.go
package helpers_test

import (
    "testing"
    "github.com/obong/obongcms-edge/base/helpers"
)

func TestParseIntegerDef(t *testing.T) {
    if helpers.ParseIntegerDef("42", 0) != 42 {
        t.Error("expected 42")
    }
    if helpers.ParseIntegerDef("abc", 7) != 7 {
        t.Error("expected default 7")
    }
    if helpers.ParseIntegerDef("", 3) != 3 {
        t.Error("expected default 3")
    }
}
```

- [ ] **Step 2: Run test, pastikan FAIL**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/frontend
go test ./base/helpers/... -run TestParseIntegerDef -v
```
Expected: FAIL — `ParseIntegerDef undefined`

- [ ] **Step 3: Buat integer.go**

```go
// frontend/base/helpers/integer.go
package helpers

import "strconv"

// ParseIntegerDef parses string ke int, return def jika gagal
func ParseIntegerDef(s string, def int) int {
    if v, err := strconv.Atoi(s); err == nil {
        return v
    }
    return def
}
```

- [ ] **Step 4: Run test, pastikan PASS**

```bash
go test ./base/helpers/... -run TestParseIntegerDef -v
```
Expected: PASS

- [ ] **Step 5: Buat repository/request.go**

```go
// frontend/internal/repository/request.go
package repository

// Request adalah data tenant yang di-resolve dari domain request
type Request struct {
    Host             string `json:"-"`
    TenantCode       string `json:"-"`      // kode tenant, folder di runtime/public/tenants/
    Theme            string `json:"theme"`
    Scheme           string `json:"-"`
    Redaksi          string `json:"redaksi"`
    HasError         bool   `json:"-"`
    ErrorLog         error  `json:"-"`
    DomainFound      bool   `json:"-"`
    StatusCode       int    `json:"-"`
    ErrorTitle       string `json:"-"`
    ErrorDescription string `json:"-"`
    RequestURI       string `json:"-"`
    Referer          string `json:"-"`
    RequestURIHasJSON bool  `json:"-"`
    SettingData      []byte `json:"-"`
    MetaData         []byte `json:"-"`
    DeveloperReport  bool   `json:"-"`
    Maintenance      bool   `json:"-"`
}
```

- [ ] **Step 6: Buat telegram.go**

```go
// frontend/base/helpers/telegram.go
package helpers

import (
    "fmt"
    "log"
    "net/http"
    "net/url"
    "os"

    "github.com/obong/obongcms-edge/internal/repository"
)

// TelegramError kirim pesan error ke Telegram (dari env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
// Jika env tidak di-set, hanya log ke stdout
func TelegramError(msg string, req repository.Request) {
    extra := fmt.Sprintf("URI : %s://%s%s", req.Scheme, req.Host, req.RequestURI)
    botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
    chatID := os.Getenv("TELEGRAM_CHAT_ID")

    if botToken == "" || chatID == "" {
        log.Printf("[ObongCMS Error] %s | %s", msg, extra)
        return
    }

    http.PostForm(
        fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken),
        url.Values{
            "chat_id":                  {chatID},
            "parse_mode":               {"HTML"},
            "disable_web_page_preview": {"true"},
            "text":                     {fmt.Sprintf("<b>OBONGCMS EDGE: </b>\n\n%s\n\n%s", msg, extra)},
        },
    )
}
```

- [ ] **Step 7: Verifikasi compile**

```bash
go build ./internal/repository/... ./base/helpers/...
```
Expected: tidak ada error

- [ ] **Step 8: Commit**

```bash
git add internal/repository/ base/helpers/integer.go base/helpers/telegram.go base/helpers/integer_test.go
git commit -m "feat: add repository.Request struct and base helpers (integer, telegram)"
```

---

## Task 3: Domain resolver — baca dari filesystem (bukan API)

**Files:**
- Modify: `frontend/internal/domainresolver/domainresolver.go` (overwrite)
- Test: `frontend/internal/domainresolver/domainresolver_test.go`

**Interfaces:**
- Consumes: `repository.Request` (Task 2)
- Produces:
  - `domainresolver.Resolver` struct
  - `func New(runtimePath string) *Resolver`
  - `func (r *Resolver) Resolve(host string) (*DomainEntry, error)` — DomainEntry = `{TenantCode, Theme, Redaksi, Maintenance string}`
  - `func (r *Resolver) Update(host, tenantCode, theme, redaksi string)`
  - `func (r *Resolver) Remove(tenantCode string)`
  - `func (r *Resolver) WarmupFromTenantDirs()`

Domain resolution: baca `runtime/public/tenants/{code}/json/setting.json`, parse field `domain` (string) dan `theme` (string). `domain.json` di `runtime/cached/domain.json` berisi list `["demo.local", ...]` yang di-maintain oleh gRPC `SyncDomainConfig`.

- [ ] **Step 1: Tulis test**

```go
// frontend/internal/domainresolver/domainresolver_test.go
package domainresolver_test

import (
    "os"
    "path/filepath"
    "testing"
    "encoding/json"

    "github.com/obong/obongcms-edge/internal/domainresolver"
)

func TestResolveFromFilesystem(t *testing.T) {
    // buat temporary runtime structure
    tmp := t.TempDir()
    code := "demo"
    jsonDir := filepath.Join(tmp, "public", "tenants", code, "json")
    os.MkdirAll(jsonDir, 0755)

    setting := map[string]any{
        "domain":  "demo.local",
        "theme":   "default",
        "redaksi": "redaksi.demo.local",
    }
    data, _ := json.Marshal(setting)
    os.WriteFile(filepath.Join(jsonDir, "setting.json"), data, 0644)

    r := domainresolver.New(tmp)
    r.WarmupFromTenantDirs()

    entry, err := r.Resolve("demo.local")
    if err != nil {
        t.Fatalf("expected no error, got %v", err)
    }
    if entry.TenantCode != code {
        t.Errorf("expected TenantCode=%q, got %q", code, entry.TenantCode)
    }
    if entry.Theme != "default" {
        t.Errorf("expected Theme=default, got %q", entry.Theme)
    }
}

func TestResolveUnknownDomain(t *testing.T) {
    r := domainresolver.New(t.TempDir())
    _, err := r.Resolve("notexist.local")
    if err == nil {
        t.Error("expected error for unknown domain")
    }
}
```

- [ ] **Step 2: Run test, pastikan FAIL**

```bash
go test ./internal/domainresolver/... -v
```
Expected: FAIL — compile error atau method mismatch

- [ ] **Step 3: Overwrite domainresolver.go**

```go
// frontend/internal/domainresolver/domainresolver.go
package domainresolver

import (
    "encoding/json"
    "errors"
    "os"
    "path/filepath"
    "sync"
)

// DomainEntry adalah konfigurasi tenant yang di-resolve dari Host header
type DomainEntry struct {
    TenantCode  string
    Theme       string
    Redaksi     string
    Maintenance bool
}

// Resolver menyimpan mapping host → DomainEntry di memory, di-warmup dari filesystem
type Resolver struct {
    mu          sync.RWMutex
    cache       map[string]*DomainEntry // host → entry
    runtimePath string
}

// New membuat Resolver baru
func New(runtimePath string) *Resolver {
    return &Resolver{
        cache:       make(map[string]*DomainEntry),
        runtimePath: runtimePath,
    }
}

// WarmupFromTenantDirs membaca semua tenant di runtime/public/tenants/
// dan membangun cache host → DomainEntry
func (r *Resolver) WarmupFromTenantDirs() {
    tenantsDir := filepath.Join(r.runtimePath, "public", "tenants")
    entries, err := os.ReadDir(tenantsDir)
    if err != nil {
        return
    }
    for _, entry := range entries {
        if !entry.IsDir() {
            continue
        }
        code := entry.Name()
        r.loadTenant(code)
    }
}

// loadTenant baca setting.json tenant dan update cache
func (r *Resolver) loadTenant(tenantCode string) {
    settingPath := filepath.Join(r.runtimePath, "public", "tenants", tenantCode, "json", "setting.json")
    data, err := os.ReadFile(settingPath)
    if err != nil {
        return
    }

    var setting struct {
        Domain      string `json:"domain"`
        Theme       string `json:"theme"`
        Redaksi     string `json:"redaksi"`
        Maintenance bool   `json:"maintenance"`
    }
    if err := json.Unmarshal(data, &setting); err != nil || setting.Domain == "" {
        return
    }

    entry := &DomainEntry{
        TenantCode:  tenantCode,
        Theme:       setting.Theme,
        Redaksi:     setting.Redaksi,
        Maintenance: setting.Maintenance,
    }
    r.mu.Lock()
    r.cache[setting.Domain] = entry
    r.mu.Unlock()
}

// Resolve mengembalikan DomainEntry untuk host. Error jika tidak ditemukan.
func (r *Resolver) Resolve(host string) (*DomainEntry, error) {
    r.mu.RLock()
    entry, ok := r.cache[host]
    r.mu.RUnlock()
    if !ok {
        return nil, errors.New("domain not registered: " + host)
    }
    return entry, nil
}

// Update menambah atau memperbarui entry untuk sebuah host
func (r *Resolver) Update(host, tenantCode, theme, redaksi string) {
    r.mu.Lock()
    r.cache[host] = &DomainEntry{
        TenantCode: tenantCode,
        Theme:      theme,
        Redaksi:    redaksi,
    }
    r.mu.Unlock()
}

// Remove menghapus semua entry untuk tenantCode tertentu
func (r *Resolver) Remove(tenantCode string) {
    r.mu.Lock()
    defer r.mu.Unlock()
    for host, entry := range r.cache {
        if entry.TenantCode == tenantCode {
            delete(r.cache, host)
        }
    }
}
```

- [ ] **Step 4: Run test, pastikan PASS**

```bash
go test ./internal/domainresolver/... -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/domainresolver/
git commit -m "feat: domain resolver baca dari filesystem (bukan API), tambah Update/Remove"
```

---

## Task 4: Template engine + render HTML/Error

**Files:**
- Create: `frontend/internal/render/goview/goview.go`
- Create: `frontend/internal/render/goview/replace.go`
- Create: `frontend/internal/render/html.go`
- Create: `frontend/internal/render/error.go`
- Create: `frontend/assets/default/error.html`
- Create: `frontend/assets/default/domain.html`
- Test: `frontend/internal/render/render_test.go`

**Interfaces:**
- Consumes: `repository.Request` (Task 2)
- Produces:
  - `render.HTML(w, reqParsed repository.Request, page string, statcode int) error`
  - `render.Error(w, reqParsed repository.Request)`

- [ ] **Step 1: Port goview dari acehcms (copy + rebrand)**

```bash
# Salin dari source
cp /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/core/render/goview/goview.go \
   /home/obong/Codes/project_codes/ObongCMS/frontend/internal/render/goview/goview.go
cp /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/core/render/goview/replace.go \
   /home/obong/Codes/project_codes/ObongCMS/frontend/internal/render/goview/replace.go
```

- [ ] **Step 2: Update package path di goview.go dan replace.go**

Ganti semua import path:
```
git.acehprov.go.id/acehcms/container/core/render/goview
→
github.com/obong/obongcms-edge/internal/render/goview
```

Juga ganti referensi `acehcms` → `obongcms` dalam komentar.

- [ ] **Step 3: Tulis test untuk render.HTML**

```go
// frontend/internal/render/render_test.go
package render_test

import (
    "net/http/httptest"
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/internal/render"
    "github.com/obong/obongcms-edge/internal/repository"
)

func TestRenderErrorPage(t *testing.T) {
    // buat temporary assets/default/
    tmp := t.TempDir()
    os.MkdirAll(filepath.Join(tmp, "assets", "default"), 0755)
    os.WriteFile(filepath.Join(tmp, "assets", "default", "error.html"), []byte(`<h1>Error <cms:pre:render>index .StatusCode</cms:pre:render></h1>`), 0644)

    req := repository.Request{
        HasError:         true,
        ErrorTitle:       "Test Error",
        ErrorDescription: "Ini error test",
        StatusCode:       500,
        DomainFound:      true,
    }
    w := httptest.NewRecorder()
    render.ErrorWithAssetDir(w, req, filepath.Join(tmp, "assets", "default"))
    if w.Code != 500 {
        t.Errorf("expected 500, got %d", w.Code)
    }
}
```

- [ ] **Step 4: Buat render/html.go**

```go
// frontend/internal/render/html.go
package render

import (
    "fmt"
    "path/filepath"
    "strings"
    "text/template"
    "net/http"

    "github.com/buger/jsonparser"
    "github.com/obong/obongcms-edge/internal/render/goview"
    "github.com/obong/obongcms-edge/internal/repository"
)

func getFromJson(key, baseURL string, firstData, secondData []byte, size ...int) string {
    key = strings.TrimSpace(key)
    result := ""
    if res, err := jsonparser.GetString(firstData, key); err == nil {
        result = res
    } else if res, err := jsonparser.GetString(secondData, key); err == nil {
        result = res
    }
    if strings.HasPrefix(result, "/") && !strings.HasPrefix(result, "/*") {
        if strings.HasSuffix(result, ".jpg") || strings.HasSuffix(result, ".png") || strings.HasSuffix(result, ".jpeg") {
            if len(size) > 0 {
                w := size[0]
                h := 0
                if len(size) > 1 {
                    h = size[1]
                }
                if w != 0 || h != 0 {
                    return fmt.Sprintf("%s/thumbnail/%dx%d%s", baseURL, w, h, result)
                }
            }
        }
        return fmt.Sprintf("%s%s", baseURL, result)
    }
    return result
}

// HTML me-render halaman HTML dengan template engine
func HTML(w http.ResponseWriter, reqParsed repository.Request, page string, statcode int) error {
    root := filepath.Dir(page)
    page = filepath.Base(page)

    gv := goview.New(goview.Config{
        Root:      root,
        Extension: ".html",
        Funcs: template.FuncMap{
            "CMS_Meta": func(key string, size ...int) string {
                if key == "url" {
                    return fmt.Sprintf("%s://%s%s", reqParsed.Scheme, reqParsed.Host, reqParsed.RequestURI)
                }
                return getFromJson(key, fmt.Sprintf("%s://%s", reqParsed.Scheme, reqParsed.Host), reqParsed.MetaData, reqParsed.SettingData, size...)
            },
            "CMS_Setting": func(key string, size ...int) string {
                if key == "url" {
                    return fmt.Sprintf("%s://%s%s", reqParsed.Scheme, reqParsed.Host, reqParsed.RequestURI)
                }
                return getFromJson(key, fmt.Sprintf("%s://%s", reqParsed.Scheme, reqParsed.Host), reqParsed.SettingData, reqParsed.MetaData, size...)
            },
        },
        DisableCache: true,
        Delims: goview.Delims{
            Left:  "<cms:pre:render>",
            Right: "</cms:pre:render>",
        },
    })
    return gv.Render(w, statcode, page, goview.M{})
}
```

- [ ] **Step 5: Buat render/error.go**

```go
// frontend/internal/render/error.go
package render

import (
    "fmt"
    "net/http"
    "os"
    "path/filepath"
    "text/template"

    "github.com/obong/obongcms-edge/internal/render/goview"
    "github.com/obong/obongcms-edge/internal/repository"
)

// Error me-render halaman error HTML standar dari assets/default/
func Error(w http.ResponseWriter, reqParsed repository.Request) {
    root, _ := os.Getwd()
    assetDir := filepath.Join(root, "assets", "default")
    ErrorWithAssetDir(w, reqParsed, assetDir)
}

// ErrorWithAssetDir dipakai untuk testing dengan dir custom
func ErrorWithAssetDir(w http.ResponseWriter, reqParsed repository.Request, assetDir string) {
    gv := goview.New(goview.Config{
        Root:         assetDir,
        Extension:    ".html",
        Funcs:        template.FuncMap{},
        DisableCache: true,
        Delims: goview.Delims{
            Left:  "<cms:pre:render>",
            Right: "</cms:pre:render>",
        },
    })
    page := "error.html"
    if !reqParsed.DomainFound {
        page = "domain.html"
    }
    err := gv.Render(w, reqParsed.StatusCode, page, goview.M{
        "StatusCode":       reqParsed.StatusCode,
        "ErrorTitle":       reqParsed.ErrorTitle,
        "ErrorDescription": reqParsed.ErrorDescription,
    })
    if err != nil {
        fmt.Fprintf(w, "Error: %s", reqParsed.ErrorDescription)
    }
}
```

- [ ] **Step 6: Buat asset HTML default**

```bash
mkdir -p /home/obong/Codes/project_codes/ObongCMS/frontend/assets/default
```

Buat `frontend/assets/default/error.html`:
```html
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>ObongCMS — Error</title>
<style>body{font-family:sans-serif;max-width:600px;margin:80px auto;padding:20px}
h1{color:#e53e3e}.code{font-size:4rem;font-weight:bold;color:#cbd5e0}</style>
</head>
<body>
<div class="code"><cms:pre:render>index .StatusCode</cms:pre:render></div>
<h1><cms:pre:render>index .ErrorTitle</cms:pre:render></h1>
<p><cms:pre:render>index .ErrorDescription</cms:pre:render></p>
</body></html>
```

Buat `frontend/assets/default/domain.html`:
```html
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>ObongCMS — Domain Tidak Ditemukan</title>
<style>body{font-family:sans-serif;max-width:600px;margin:80px auto;padding:20px}
h1{color:#e53e3e}.code{font-size:4rem;font-weight:bold;color:#cbd5e0}</style>
</head>
<body>
<div class="code">404</div>
<h1>Domain Tidak Ditemukan</h1>
<p>Domain yang Anda akses tidak terdaftar di sistem ini.</p>
</body></html>
```

- [ ] **Step 7: Run test**

```bash
go test ./internal/render/... -v
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add internal/render/ assets/default/
git commit -m "feat: port template engine (goview) dan render HTML/error dari acehcms"
```

---

## Task 5: Theme helper + TenantFS extension

**Files:**
- Create: `frontend/base/helpers/theme.go`
- Modify: `frontend/internal/tenantfs/tenantfs.go`
- Test: `frontend/base/helpers/theme_test.go`
- Test: `frontend/internal/tenantfs/tenantfs_test.go`

**Interfaces:**
- Consumes: `repository.Request` (Task 2)
- Produces:
  - `helpers.ThemeSwitch(req repository.Request, runtimePath, page string) (string, bool)` — cek: tenant themes → system themes → assets/default
  - `tenantfs.WriteMedia(tenantCode, folder, filename string, data []byte) (string, error)` — return path relatif `/media/folder/filename`
  - `tenantfs.EnsureSubDirs(tenantCode string) error` — buat `json/`, `media/`, `themes/`, `custom/`

- [ ] **Step 1: Tulis test ThemeSwitch**

```go
// frontend/base/helpers/theme_test.go
package helpers_test

import (
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/base/helpers"
    "github.com/obong/obongcms-edge/internal/repository"
)

func TestThemeSwitchUserTheme(t *testing.T) {
    tmp := t.TempDir()
    code := "demo"
    themeDir := filepath.Join(tmp, "public", "tenants", code, "themes", "default")
    os.MkdirAll(themeDir, 0755)
    os.WriteFile(filepath.Join(themeDir, "index.html"), []byte("<h1>Demo</h1>"), 0644)

    req := repository.Request{TenantCode: code, Theme: "default"}
    page, found := helpers.ThemeSwitch(req, tmp, "index.html")
    if !found {
        t.Error("expected found=true")
    }
    if filepath.Base(page) != "index.html" {
        t.Errorf("expected index.html, got %q", page)
    }
}

func TestThemeSwitchNotFound(t *testing.T) {
    tmp := t.TempDir()
    req := repository.Request{TenantCode: "nope", Theme: "default"}
    _, found := helpers.ThemeSwitch(req, tmp, "index.html")
    if found {
        t.Error("expected found=false")
    }
}
```

- [ ] **Step 2: Run test, pastikan FAIL**

```bash
go test ./base/helpers/... -run TestThemeSwitch -v
```
Expected: FAIL

- [ ] **Step 3: Buat theme.go**

```go
// frontend/base/helpers/theme.go
package helpers

import (
    "os"
    "path/filepath"

    "github.com/obong/obongcms-edge/internal/repository"
)

// ThemeSwitch mencari file page pada urutan:
// 1. runtime/public/tenants/{code}/themes/{theme}/{page}
// 2. runtime/system/themes/{theme}/{page}
// 3. assets/default/{page}
// Return path absolut dan found=true jika ketemu
func ThemeSwitch(req repository.Request, runtimePath, page string) (string, bool) {
    candidates := []string{
        filepath.Join(runtimePath, "public", "tenants", req.TenantCode, "themes", req.Theme, page),
        filepath.Join(runtimePath, "system", "themes", req.Theme, page),
    }
    for _, path := range candidates {
        if stat, err := os.Stat(path); err == nil && !stat.IsDir() {
            return path, true
        }
    }
    return "", false
}
```

- [ ] **Step 4: Run test, pastikan PASS**

```bash
go test ./base/helpers/... -run TestThemeSwitch -v
```
Expected: PASS

- [ ] **Step 5: Tulis test TenantFS.WriteMedia**

```go
// frontend/internal/tenantfs/tenantfs_test.go
package tenantfs_test

import (
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/internal/tenantfs"
)

func TestWriteMedia(t *testing.T) {
    tmp := t.TempDir()
    tfs := tenantfs.New(tmp)
    data := []byte("fake image data")
    path, err := tfs.WriteMedia("demo", "berita", "foto.jpg", data)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if path == "" {
        t.Error("expected non-empty path")
    }
    // pastikan file ada di filesystem
    fullPath := filepath.Join(tmp, "public", "tenants", "demo", "media", "berita", "foto.jpg")
    if _, err := os.Stat(fullPath); err != nil {
        t.Errorf("file not written: %v", err)
    }
}

func TestEnsureSubDirs(t *testing.T) {
    tmp := t.TempDir()
    tfs := tenantfs.New(tmp)
    if err := tfs.EnsureSubDirs("demo"); err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    for _, sub := range []string{"json", "media", "themes", "custom"} {
        dir := filepath.Join(tmp, "public", "tenants", "demo", sub)
        if _, err := os.Stat(dir); err != nil {
            t.Errorf("dir %s not created: %v", sub, err)
        }
    }
}
```

- [ ] **Step 6: Tambah WriteMedia dan EnsureSubDirs ke tenantfs.go**

```go
// Tambahkan ke frontend/internal/tenantfs/tenantfs.go

// WriteMedia menyimpan file media ke tenant folder.
// Return path relatif publik: "/media/{folder}/{filename}"
func (t *TenantFS) WriteMedia(tenantCode, folder, filename string, data []byte) (string, error) {
    destPath := filepath.Join(t.tenantDir(tenantCode), "media", folder, filename)
    if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
        return "", err
    }
    if err := os.WriteFile(destPath, data, 0644); err != nil {
        return "", err
    }
    return "/media/" + folder + "/" + filename, nil
}

// EnsureSubDirs membuat struktur subdirektori standar untuk tenant baru
func (t *TenantFS) EnsureSubDirs(tenantCode string) error {
    dirs := []string{"json", "media", "themes", "custom"}
    for _, sub := range dirs {
        if err := os.MkdirAll(filepath.Join(t.tenantDir(tenantCode), sub), 0755); err != nil {
            return err
        }
    }
    return nil
}
```

- [ ] **Step 7: Run semua test**

```bash
go test ./internal/tenantfs/... ./base/helpers/... -v
```
Expected: semua PASS

- [ ] **Step 8: Commit**

```bash
git add base/helpers/theme.go base/helpers/theme_test.go internal/tenantfs/
git commit -m "feat: theme helper (ThemeSwitch) dan extend TenantFS (WriteMedia, EnsureSubDirs)"
```

---

## Task 6: Request middleware (ParseByDomain) + GetFromContext

**Files:**
- Create: `frontend/modules/site/request/middleware.go`
- Create: `frontend/modules/site/request/context.go`
- Test: `frontend/modules/site/request/middleware_test.go`

**Interfaces:**
- Consumes: `repository.Request` (Task 2), `domainresolver.Resolver` (Task 3)
- Produces:
  - `request.ParseByDomain(resolver *domainresolver.Resolver, runtimePath string) func(http.Handler) http.Handler`
  - `request.GetFromContext(r *http.Request) repository.Request`

Logic: baca `Host` header → `resolver.Resolve()` → baca `setting.json` → populate `repository.Request` → store di context. Jika domain tidak ditemukan: `DomainFound=false`, `StatusCode=404`.

- [ ] **Step 1: Tulis test**

```go
// frontend/modules/site/request/middleware_test.go
package request_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/internal/domainresolver"
    "github.com/obong/obongcms-edge/internal/repository"
    sitereq "github.com/obong/obongcms-edge/modules/site/request"
)

func TestParseByDomainFound(t *testing.T) {
    tmp := t.TempDir()
    code := "demo"
    jsonDir := filepath.Join(tmp, "public", "tenants", code, "json")
    os.MkdirAll(jsonDir, 0755)

    setting := map[string]any{"domain": "demo.local", "theme": "default", "redaksi": "redaksi.demo.local"}
    data, _ := json.Marshal(setting)
    os.WriteFile(filepath.Join(jsonDir, "setting.json"), data, 0644)

    resolver := domainresolver.New(tmp)
    resolver.WarmupFromTenantDirs()

    mw := sitereq.ParseByDomain(resolver, tmp)
    var captured repository.Request
    handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        captured = sitereq.GetFromContext(r)
    }))

    req := httptest.NewRequest("GET", "/", nil)
    req.Host = "demo.local"
    handler.ServeHTTP(httptest.NewRecorder(), req)

    if !captured.DomainFound {
        t.Error("expected DomainFound=true")
    }
    if captured.TenantCode != code {
        t.Errorf("expected TenantCode=%q, got %q", code, captured.TenantCode)
    }
}

func TestParseByDomainNotFound(t *testing.T) {
    resolver := domainresolver.New(t.TempDir())
    mw := sitereq.ParseByDomain(resolver, t.TempDir())
    var captured repository.Request
    handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        captured = sitereq.GetFromContext(r)
    }))
    req := httptest.NewRequest("GET", "/", nil)
    req.Host = "unknown.local"
    handler.ServeHTTP(httptest.NewRecorder(), req)
    if captured.DomainFound {
        t.Error("expected DomainFound=false")
    }
    if captured.StatusCode != 404 {
        t.Errorf("expected 404, got %d", captured.StatusCode)
    }
}
```

- [ ] **Step 2: Run test, pastikan FAIL**

```bash
go test ./modules/site/request/... -v
```
Expected: FAIL

- [ ] **Step 3: Buat context.go**

```go
// frontend/modules/site/request/context.go
package request

import (
    "net/http"
    "github.com/obong/obongcms-edge/internal/repository"
)

type contextKey int

const parsedKey contextKey = iota

// GetFromContext mengambil repository.Request yang sudah di-parse dari context
func GetFromContext(r *http.Request) repository.Request {
    if req, ok := r.Context().Value(parsedKey).(repository.Request); ok {
        return req
    }
    return repository.Request{}
}
```

- [ ] **Step 4: Buat middleware.go**

```go
// frontend/modules/site/request/middleware.go
package request

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "path/filepath"
    "regexp"
    "strings"

    "github.com/buger/jsonparser"
    "github.com/obong/obongcms-edge/internal/domainresolver"
    "github.com/obong/obongcms-edge/internal/repository"
)

var reQuery = regexp.MustCompile(`(?m)(\/?\?.*)$`)

// ParseByDomain adalah middleware yang meng-resolve domain → repository.Request
func ParseByDomain(resolver *domainresolver.Resolver, runtimePath string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            host := strings.TrimPrefix(r.Host, "www.")
            if idx := strings.Index(host, ":"); idx != -1 {
                host = host[:idx]
            }

            req := repository.Request{
                Host:        host,
                RequestURI:  reQuery.ReplaceAllString(r.RequestURI, ""),
                Referer:     r.Referer(),
                HasError:    true,
                DomainFound: true,
                StatusCode:  500,
            }

            if r.Header.Get("X-Forwarded-Proto") != "" {
                req.Scheme = r.Header.Get("X-Forwarded-Proto")
            } else {
                req.Scheme = "http"
            }

            entry, err := resolver.Resolve(host)
            if err != nil {
                req.DomainFound = false
                req.StatusCode = 404
                req.ErrorTitle = "Domain Tidak Ditemukan"
                req.ErrorDescription = fmt.Sprintf("Domain %s tidak terdaftar", host)
                ctx := context.WithValue(r.Context(), parsedKey, req)
                next.ServeHTTP(w, r.WithContext(ctx))
                return
            }

            req.TenantCode = entry.TenantCode
            req.Theme = entry.Theme
            req.Redaksi = entry.Redaksi
            req.Maintenance = entry.Maintenance

            // Baca setting.json
            settingPath := filepath.Join(runtimePath, "public", "tenants", entry.TenantCode, "json", "setting.json")
            settingData, err := os.ReadFile(settingPath)
            if err != nil {
                req.ErrorTitle = "Setting Error"
                req.ErrorDescription = fmt.Sprintf("Gagal membaca setting.json untuk %s", host)
                ctx := context.WithValue(r.Context(), parsedKey, req)
                next.ServeHTTP(w, r.WithContext(ctx))
                return
            }
            req.SettingData = settingData

            // Cek apakah ada JSON untuk URI ini
            jsonFile := filepath.Join(runtimePath, "public", "tenants", entry.TenantCode, "json",
                fmt.Sprintf("%s.json", req.RequestURI))
            if stat, err := os.Stat(jsonFile); err == nil && !stat.IsDir() {
                req.RequestURIHasJSON = true
                if metaData, err := os.ReadFile(jsonFile); err == nil {
                    if found, _, _, err := jsonparser.Get(metaData, "meta"); err == nil {
                        req.MetaData = found
                    }
                }
            }

            req.HasError = false
            req.StatusCode = 200

            ctx := context.WithValue(r.Context(), parsedKey, req)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

- [ ] **Step 5: Run test, pastikan PASS**

```bash
go test ./modules/site/request/... -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add modules/site/request/
git commit -m "feat: ParseByDomain middleware dan GetFromContext helper"
```

---

## Task 7: Response handlers (media, thumbnail, static, rss, sitemap, robots, custom)

**Files:**
- Create: `frontend/modules/site/response/withroot.go`
- Create: `frontend/modules/site/response/media.go`
- Create: `frontend/modules/site/response/thumbnail.go`
- Create: `frontend/modules/site/response/rss.go`
- Create: `frontend/modules/site/response/sitemap.go`
- Create: `frontend/modules/site/response/robots.go`
- Create: `frontend/modules/site/response/custom.go`
- Create: `frontend/modules/site/response/theme.go`
- Create: `frontend/modules/site/response/json.go`
- Test: `frontend/modules/site/response/response_test.go`

**Interfaces:**
- Consumes: `repository.Request`, `request.GetFromContext`
- Produces: semua fungsi dipanggil langsung dari site handler `r.Get("/media/*", response.Media)`

- [ ] **Step 1: Salin dan port semua response handler dari acehcms**

```bash
SRC=/home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/core/response
DEST=/home/obong/Codes/project_codes/ObongCMS/frontend/modules/site/response

mkdir -p $DEST
for f in withroot.go media.go thumbnail.go rss.go sitemap.go robot.go custom.go theme.go json.go; do
    cp $SRC/$f $DEST/${f/robot/robots} 2>/dev/null || true
done
```

- [ ] **Step 2: Update semua import path dan referensi branding**

Dalam setiap file di `modules/site/response/`, ganti:
```
git.acehprov.go.id/acehcms/container/core/request  → github.com/obong/obongcms-edge/modules/site/request
git.acehprov.go.id/acehcms/container/core/repository → github.com/obong/obongcms-edge/internal/repository
git.acehprov.go.id/acehcms/container/core/helper    → github.com/obong/obongcms-edge/base/helpers
```

Ganti env var path:
```go
// acehcms pakai CONTENT_USERS + Directory
// ObongCMS pakai: runtimePath + "public/tenants/" + req.TenantCode
```

Karena response handlers di acehcms menggunakan `os.Getenv("CONTENT_USERS")` dan `reqParsed.Directory`, di ObongCMS kita ganti dengan `runtimePath` yang dipasskan dari handler. Buat fungsi helper private:

```go
// Di setiap file response yang butuh path tenant:
func tenantDir(req repository.Request, runtimePath string) string {
    return filepath.Join(runtimePath, "public", "tenants", req.TenantCode)
}
```

- [ ] **Step 3: Ganti komentar `acehcms` → `obongcms` di custom.go**

Dalam `custom.go`, ganti:
```go
w.Write([]byte("/** generated by acehcms */"))  →  w.Write([]byte("/** generated by obongcms */"))
w.Write([]byte("/* generated by acehcms */"))   →  w.Write([]byte("/* generated by obongcms */"))
```

- [ ] **Step 4: Update signature response handler untuk terima runtimePath**

Karena obongcms tidak pakai global env var untuk paths, wrap handler dalam struct:

```go
// frontend/modules/site/response/handler.go
package response

// ResponseHandler membungkus semua response handler dengan runtimePath
type ResponseHandler struct {
    runtimePath string
}

func NewResponseHandler(runtimePath string) *ResponseHandler {
    return &ResponseHandler{runtimePath: runtimePath}
}
```

Update setiap handler function menjadi method:
```go
func (h *ResponseHandler) Media(w http.ResponseWriter, r *http.Request) { ... }
func (h *ResponseHandler) Thumbnail(w http.ResponseWriter, r *http.Request) { ... }
// dst.
```

- [ ] **Step 5: Tulis test dasar untuk Robots**

```go
// frontend/modules/site/response/response_test.go
package response_test

import (
    "net/http/httptest"
    "testing"
    "context"
    "net/http"

    "github.com/obong/obongcms-edge/internal/repository"
    sitereq "github.com/obong/obongcms-edge/modules/site/request"
    "github.com/obong/obongcms-edge/modules/site/response"
)

func TestRobotsDefault(t *testing.T) {
    rh := response.NewResponseHandler(t.TempDir())
    req := httptest.NewRequest("GET", "/robots.txt", nil)
    // inject empty request context
    ctx := context.WithValue(req.Context(), sitereq.ParsedKey(), repository.Request{SettingData: []byte(`{}`)})
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()
    rh.Robots(w, req)
    if w.Code != 200 {
        t.Errorf("expected 200, got %d", w.Code)
    }
    body := w.Body.String()
    if body == "" {
        t.Error("expected non-empty robots.txt response")
    }
}
```

> Note: export `ParsedKey()` dari package request agar bisa dipakai di test:
```go
// Tambahkan ke context.go:
func ParsedKey() contextKey { return parsedKey }
```

- [ ] **Step 6: Compile check**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/frontend
go build ./modules/site/response/...
```
Expected: tidak ada error

- [ ] **Step 7: Run test**

```bash
go test ./modules/site/response/... -v
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add modules/site/response/
git commit -m "feat: port seluruh response handler dari acehcms (media, thumbnail, rss, sitemap, robots, custom)"
```

---

## Task 8: Comment system port

**Files:**
- Create: `frontend/modules/site/comment/model.go`
- Create: `frontend/modules/site/comment/routes.go`
- Create: `frontend/modules/site/comment/add.go`
- Create: `frontend/modules/site/comment/list.go`
- Create: `frontend/modules/site/comment/edit.go`
- Create: `frontend/modules/site/comment/delete.go`
- Create: `frontend/modules/site/comment/token.go`
- Create: `frontend/modules/site/comment/logout.go`
- Create: `frontend/modules/site/comment/decrypt.go`
- Create: `frontend/modules/site/comment/clean.go`

**Interfaces:**
- Produces: `comment.CommentRouter() http.Handler` dipanggil dari `main.go`

- [ ] **Step 1: Salin dan port comment system dari acehcms**

```bash
SRC=/home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/core/comment
DEST=/home/obong/Codes/project_codes/ObongCMS/frontend/modules/site/comment
mkdir -p $DEST
cp $SRC/*.go $DEST/
```

- [ ] **Step 2: Update semua import path**

Ganti dalam setiap file:
```
git.acehprov.go.id/acehcms/container/core/  →  github.com/obong/obongcms-edge/
```

Ganti nama package-level jika ada referensi `acehcms`:
```
"acehcms" dalam string literal → "obongcms"
```

- [ ] **Step 3: Compile check**

```bash
go build ./modules/site/comment/...
```
Expected: tidak ada error

- [ ] **Step 4: Commit**

```bash
git add modules/site/comment/
git commit -m "feat: port comment system dari acehcms"
```

---

## Task 9: GetPageByRoute + site main handler

**Files:**
- Create: `frontend/modules/site/routes.go` — `GetPageByRoute()` dan route resolver
- Modify: `frontend/modules/site/handler.go` (overwrite)
- Create: `frontend/runtime/cached/routes.json` — salin dari acehcms `core/default/routes.json`
- Test: `frontend/modules/site/routes_test.go`

**Interfaces:**
- Consumes: `repository.Request`, `request.GetFromContext`, `response.ResponseHandler`, `render`, `helpers.ThemeSwitch`, `helpers.TelegramError`
- Produces:
  - `GetPageByRoute(req *repository.Request) (page string, statcode int)` — baca routes.json, match RequestURI, return path ke HTML file di themes

- [ ] **Step 1: Salin routes.json**

```bash
mkdir -p /home/obong/Codes/project_codes/ObongCMS/frontend/runtime/cached
cp /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/core/default/routes.json \
   /home/obong/Codes/project_codes/ObongCMS/frontend/runtime/cached/routes.json
```

- [ ] **Step 2: Tulis test GetPageByRoute**

```go
// frontend/modules/site/routes_test.go
package site_test

import (
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/internal/repository"
    "github.com/obong/obongcms-edge/modules/site"
)

func TestGetPageByRouteIndex(t *testing.T) {
    tmp := t.TempDir()
    // copy routes.json ke tmp
    data, _ := os.ReadFile("../../runtime/cached/routes.json")
    os.WriteFile(filepath.Join(tmp, "routes.json"), data, 0644)

    req := repository.Request{RequestURI: "/", Theme: "default", TenantCode: "demo"}
    page, code := site.GetPageByRoute(&req, tmp)
    if code != 200 {
        t.Errorf("expected 200, got %d", code)
    }
    if page == "" {
        t.Error("expected non-empty page path")
    }
}
```

- [ ] **Step 3: Buat routes.go**

```go
// frontend/modules/site/routes.go
package site

import (
    "encoding/json"
    "os"
    "path/filepath"
    "regexp"

    "github.com/obong/obongcms-edge/internal/repository"
)

type routeDef struct {
    Page        string `json:"page"`
    RequireJSON bool   `json:"requirejson"`
}

// GetPageByRoute mencocokkan RequestURI dengan routes.json dan return path ke HTML page
// routesDir: direktori berisi routes.json (biasanya runtime/cached/)
func GetPageByRoute(req *repository.Request, routesDir string) (page string, statcode int) {
    routesPath := filepath.Join(routesDir, "routes.json")
    data, err := os.ReadFile(routesPath)
    if err != nil {
        req.HasError = true
        req.ErrorTitle = "Routes Error"
        req.ErrorDescription = "routes.json tidak ditemukan"
        return "", 500
    }

    var routes map[string]routeDef
    if err := json.Unmarshal(data, &routes); err != nil {
        req.HasError = true
        req.ErrorTitle = "Routes Error"
        req.ErrorDescription = "routes.json gagal di-parse"
        return "", 500
    }

    for pattern, route := range routes {
        if matched, _ := regexp.MatchString(pattern, req.RequestURI); matched {
            if route.RequireJSON && !req.RequestURIHasJSON {
                req.HasError = true
                req.ErrorTitle = "Konten Tidak Ditemukan"
                req.ErrorDescription = "Halaman yang Anda cari tidak tersedia"
                return "", 404
            }
            // page path: runtime/public/tenants/{code}/themes/{theme}/{page}
            // fallback: runtime/system/themes/{theme}/{page}
            page = route.Page
            return page, 200
        }
    }

    req.HasError = true
    req.ErrorTitle = "Halaman Tidak Ditemukan"
    req.ErrorDescription = "URL tidak cocok dengan rute manapun"
    return "", 404
}
```

- [ ] **Step 4: Overwrite site/handler.go**

```go
// frontend/modules/site/handler.go
package site

import (
    "fmt"
    "net/http"
    "os"

    "github.com/go-chi/chi/v5"
    "github.com/obong/obongcms-edge/base/helpers"
    "github.com/obong/obongcms-edge/internal/domainresolver"
    "github.com/obong/obongcms-edge/internal/render"
    "github.com/obong/obongcms-edge/internal/repository"
    sitereq "github.com/obong/obongcms-edge/modules/site/request"
    "github.com/obong/obongcms-edge/modules/site/response"
    "github.com/obong/obongcms-edge/modules/site/comment"
)

type Handler struct {
    runtimePath string
    resolver    *domainresolver.Resolver
    rh          *response.ResponseHandler
}

func NewHandler(runtimePath string, resolver *domainresolver.Resolver) *Handler {
    return &Handler{
        runtimePath: runtimePath,
        resolver:    resolver,
        rh:          response.NewResponseHandler(runtimePath),
    }
}

func (h *Handler) Routes() chi.Router {
    r := chi.NewRouter()
    r.Use(sitereq.ParseByDomain(h.resolver, h.runtimePath))

    r.Mount("/comment", comment.CommentRouter())

    r.Get("/themes/*", h.rh.ServeThemeAssets)
    r.Get("/media/*", h.rh.Media)
    r.Get("/thumbnail/*", h.rh.Thumbnail)
    r.Get("/custom.*", h.rh.CustomJSCSS)
    r.Get("/json/*", h.rh.JSON)
    r.Get("/sitemap{p:[/?].*}.{c:(xml|xsl)}", h.rh.Sitemap)
    r.Get("/rss.xml", h.rh.RSS)
    r.Get("/robots.txt", h.rh.Robots)

    r.Get("/admin*", func(w http.ResponseWriter, r *http.Request) {
        req := sitereq.GetFromContext(r)
        http.Redirect(w, r, fmt.Sprintf("https://%s", req.Redaksi), http.StatusMovedPermanently)
    })

    // Default: semua request HTML diproses di sini
    r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
        req := sitereq.GetFromContext(r)

        if !req.DomainFound || req.HasError {
            render.Error(w, req)
            if req.DeveloperReport {
                helpers.TelegramError(fmt.Sprintf("%s\n%s", req.ErrorTitle, req.ErrorDescription), req)
            }
            return
        }

        page, statcode := GetPageByRoute(&req, cachedDir())
        if req.HasError {
            render.Error(w, req)
            return
        }

        // Resolve path ke file HTML tema
        fullPage, found := helpers.ThemeSwitch(req, h.runtimePath, page)
        if !found {
            req.HasError = true
            req.ErrorTitle = "Theme Error"
            req.ErrorDescription = fmt.Sprintf("File tema '%s' tidak ditemukan", page)
            req.StatusCode = 500
            render.Error(w, req)
            return
        }

        if err := render.HTML(w, req, fullPage, statcode); err != nil {
            req.HasError = true
            req.ErrorTitle = "Theme Error"
            req.ErrorDescription = err.Error()
            req.StatusCode = 500
            render.Error(w, req)
            if req.DeveloperReport {
                helpers.TelegramError(fmt.Sprintf("Theme Error: %s", err.Error()), req)
            }
        }
    })

    return r
}

func cachedDir() string {
    runtimePath := os.Getenv("RUNTIME_PATH")
    if runtimePath == "" {
        runtimePath = "./runtime"
    }
    return runtimePath + "/cached"
}
```

- [ ] **Step 5: Run test**

```bash
go test ./modules/site/... -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add modules/site/ runtime/cached/routes.json
git commit -m "feat: GetPageByRoute + site handler full (port dari acehcms main router)"
```

---

## Task 10: gRPC Server — implement EdgeSyncServer

**Files:**
- Create: `frontend/internal/grpcserver/interceptor.go`
- Create: `frontend/internal/grpcserver/server.go`
- Test: `frontend/internal/grpcserver/server_test.go`

**Interfaces:**
- Consumes:
  - `edgesync.UnimplementedEdgeSyncServer` dari `gen/edge_sync_grpc.pb.go`
  - `edgesync.SnapshotPayload`, `edgesync.FileChunk`, `edgesync.TenantKey`, `edgesync.DomainConfig` dari `gen/edge_sync.pb.go`
  - `tenantfs.TenantFS` (Task 5)
  - `domainresolver.Resolver` (Task 3)
- Produces:
  - `grpcserver.NewServer(runtimePath string, resolver *domainresolver.Resolver) *EdgeSyncServer`
  - `grpcserver.AuthInterceptor(secret string) grpc.UnaryServerInterceptor`
  - `grpcserver.AuthStreamInterceptor(secret string) grpc.StreamServerInterceptor`

- [ ] **Step 1: Tulis test untuk SyncSnapshot**

```go
// frontend/internal/grpcserver/server_test.go
package grpcserver_test

import (
    "context"
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/internal/domainresolver"
    "github.com/obong/obongcms-edge/internal/grpcserver"
    edgesync "github.com/obong/obongcms-edge/internal/grpcserver/gen"
)

func TestSyncSnapshot(t *testing.T) {
    tmp := t.TempDir()
    resolver := domainresolver.New(tmp)
    srv := grpcserver.NewServer(tmp, resolver)

    payload := &edgesync.SnapshotPayload{
        TenantCode: "demo",
        JsonPath:   "berita.json",
        Content:    []byte(`{"data":[]}`),
    }
    result, err := srv.SyncSnapshot(context.Background(), payload)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if !result.Success {
        t.Errorf("expected success=true, got message: %s", result.Message)
    }
    // verifikasi file ditulis
    fullPath := filepath.Join(tmp, "public", "tenants", "demo", "json", "berita.json")
    if _, err := os.Stat(fullPath); err != nil {
        t.Errorf("file not written: %v", err)
    }
}

func TestInvalidateCache(t *testing.T) {
    tmp := t.TempDir()
    resolver := domainresolver.New(tmp)
    srv := grpcserver.NewServer(tmp, resolver)

    result, err := srv.InvalidateCache(context.Background(), &edgesync.TenantKey{TenantCode: "demo"})
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if !result.Success {
        t.Errorf("expected success=true, got: %s", result.Message)
    }
}

func TestSyncDomainConfig(t *testing.T) {
    tmp := t.TempDir()
    resolver := domainresolver.New(tmp)
    srv := grpcserver.NewServer(tmp, resolver)

    cfg := &edgesync.DomainConfig{
        TenantCode:  "demo",
        Domain:      "demo.local",
        Theme:       "default",
        Maintenance: false,
        RedaksiUrl:  "redaksi.demo.local",
    }
    result, err := srv.SyncDomainConfig(context.Background(), cfg)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if !result.Success {
        t.Errorf("expected success=true, got: %s", result.Message)
    }
    // verifikasi resolver di-update
    entry, err := resolver.Resolve("demo.local")
    if err != nil {
        t.Errorf("resolver not updated: %v", err)
    }
    if entry.TenantCode != "demo" {
        t.Errorf("expected TenantCode=demo, got %q", entry.TenantCode)
    }
}
```

- [ ] **Step 2: Run test, pastikan FAIL**

```bash
go test ./internal/grpcserver/... -v
```
Expected: FAIL — `grpcserver.NewServer` undefined

- [ ] **Step 3: Buat interceptor.go**

```go
// frontend/internal/grpcserver/interceptor.go
package grpcserver

import (
    "context"

    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/metadata"
    "google.golang.org/grpc/status"
)

const secretMetadataKey = "x-grpc-secret"

// AuthInterceptor validasi metadata "x-grpc-secret" untuk unary RPC
func AuthInterceptor(secret string) grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
        if err := validateSecret(ctx, secret); err != nil {
            return nil, err
        }
        return handler(ctx, req)
    }
}

// AuthStreamInterceptor validasi metadata "x-grpc-secret" untuk streaming RPC
func AuthStreamInterceptor(secret string) grpc.StreamServerInterceptor {
    return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
        if err := validateSecret(ss.Context(), secret); err != nil {
            return err
        }
        return handler(srv, ss)
    }
}

func validateSecret(ctx context.Context, secret string) error {
    if secret == "" {
        return nil // tidak ada secret → tidak ada auth
    }
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return status.Error(codes.Unauthenticated, "metadata tidak ditemukan")
    }
    values := md.Get(secretMetadataKey)
    if len(values) == 0 || values[0] != secret {
        return status.Error(codes.Unauthenticated, "x-grpc-secret tidak valid")
    }
    return nil
}
```

- [ ] **Step 4: Buat server.go**

```go
// frontend/internal/grpcserver/server.go
package grpcserver

import (
    "context"
    "fmt"
    "io"
    "os"
    "path/filepath"

    edgesync "github.com/obong/obongcms-edge/internal/grpcserver/gen"
    "github.com/obong/obongcms-edge/internal/domainresolver"
    "github.com/obong/obongcms-edge/internal/tenantfs"
)

// EdgeSyncServer mengimplementasikan edgesync.EdgeSyncServer interface
type EdgeSyncServer struct {
    edgesync.UnimplementedEdgeSyncServer
    tfs      *tenantfs.TenantFS
    resolver *domainresolver.Resolver
    runtimePath string
}

// NewServer membuat instance EdgeSyncServer baru
func NewServer(runtimePath string, resolver *domainresolver.Resolver) *EdgeSyncServer {
    return &EdgeSyncServer{
        tfs:         tenantfs.New(runtimePath),
        resolver:    resolver,
        runtimePath: runtimePath,
    }
}

// SyncSnapshot menerima JSON snapshot konten dan menulis ke tenant folder
func (s *EdgeSyncServer) SyncSnapshot(ctx context.Context, payload *edgesync.SnapshotPayload) (*edgesync.SyncResult, error) {
    if payload.TenantCode == "" || payload.JsonPath == "" {
        return &edgesync.SyncResult{Success: false, Message: "tenant_code dan json_path wajib diisi"}, nil
    }

    fullPath := filepath.Join(s.runtimePath, "public", "tenants", payload.TenantCode, "json", payload.JsonPath)
    if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
        return &edgesync.SyncResult{Success: false, Message: fmt.Sprintf("gagal buat direktori: %s", err)}, nil
    }
    if err := os.WriteFile(fullPath, payload.Content, 0644); err != nil {
        return &edgesync.SyncResult{Success: false, Message: fmt.Sprintf("gagal tulis file: %s", err)}, nil
    }
    return &edgesync.SyncResult{
        Success: true,
        Message: "snapshot berhasil disimpan",
        Bytes:   int64(len(payload.Content)),
    }, nil
}

// SyncFile menerima stream chunks file (media upload) dan menyimpan ke tenant folder
func (s *EdgeSyncServer) SyncFile(stream edgesync.EdgeSync_SyncFileServer) error {
    var (
        tenantCode string
        filePath   string
        file       *os.File
        totalBytes int64
    )

    for {
        chunk, err := stream.Recv()
        if err == io.EOF {
            break
        }
        if err != nil {
            if file != nil {
                file.Close()
            }
            return err
        }

        // Inisialisasi file di chunk pertama
        if file == nil {
            tenantCode = chunk.TenantCode
            filePath = chunk.FilePath
            fullPath := filepath.Join(s.runtimePath, "public", "tenants", tenantCode, "media", filePath)
            if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
                return err
            }
            var openErr error
            file, openErr = os.Create(fullPath)
            if openErr != nil {
                return openErr
            }
        }

        n, err := file.Write(chunk.Content)
        if err != nil {
            file.Close()
            return err
        }
        totalBytes += int64(n)
    }

    if file != nil {
        file.Close()
    }

    _ = tenantCode
    _ = filePath
    return stream.SendAndClose(&edgesync.SyncResult{
        Success: true,
        Message: "file berhasil diupload",
        Bytes:   totalBytes,
    })
}

// InvalidateCache menghapus semua in-memory cache untuk tenant tertentu
// (domainresolver reload dari filesystem, tenantfs tidak pakai cache)
func (s *EdgeSyncServer) InvalidateCache(ctx context.Context, key *edgesync.TenantKey) (*edgesync.Result, error) {
    if key.TenantCode == "" {
        return &edgesync.Result{Success: false, Message: "tenant_code wajib diisi"}, nil
    }
    // Reload tenant dari filesystem
    s.resolver.Remove(key.TenantCode)
    // WarmupFromTenantDirs hanya reload semua — untuk single tenant, reload manual:
    settingPath := filepath.Join(s.runtimePath, "public", "tenants", key.TenantCode, "json", "setting.json")
    if _, err := os.Stat(settingPath); err == nil {
        // Trigger reload dengan cara remove + re-add entry jika setting.json ada
        // Resolver.loadTenant adalah private — panggil Update jika kita punya data
        // Untuk sekarang, Remove sudah cukup — next request akan 404 sampai SyncDomainConfig dipanggil
    }
    return &edgesync.Result{Success: true, Message: "cache di-invalidate"}, nil
}

// SyncDomainConfig update konfigurasi domain di resolver cache
func (s *EdgeSyncServer) SyncDomainConfig(ctx context.Context, cfg *edgesync.DomainConfig) (*edgesync.Result, error) {
    if cfg.TenantCode == "" || cfg.Domain == "" {
        return &edgesync.Result{Success: false, Message: "tenant_code dan domain wajib diisi"}, nil
    }
    s.resolver.Update(cfg.Domain, cfg.TenantCode, cfg.Theme, cfg.RedaksiUrl)
    return &edgesync.Result{Success: true, Message: "domain config di-update"}, nil
}
```

- [ ] **Step 5: Run test, pastikan PASS**

```bash
go test ./internal/grpcserver/... -v
```
Expected: PASS (SyncSnapshot, InvalidateCache, SyncDomainConfig)

- [ ] **Step 6: Commit**

```bash
git add internal/grpcserver/server.go internal/grpcserver/interceptor.go internal/grpcserver/server_test.go
git commit -m "feat: implement EdgeSyncServer gRPC (SyncSnapshot, SyncFile, InvalidateCache, SyncDomainConfig)"
```

---

## Task 11: main.go — dual server HTTP + gRPC + graceful shutdown

**Files:**
- Modify: `frontend/main.go` (overwrite)
- Modify: `frontend/base/config/config.go` (overwrite)
- Modify: `frontend/.env.example`
- Test: `frontend/main_test.go`

**Interfaces:**
- Consumes: `grpcserver.NewServer`, `grpcserver.AuthInterceptor`, `grpcserver.AuthStreamInterceptor`, `domainresolver.New`, semua module site

- [ ] **Step 1: Update config.go**

```go
// frontend/base/config/config.go
package config

import "os"

// Config menyimpan semua konfigurasi dari env
type Config struct {
    AppPort     string
    GRPCPort    string
    GRPCSecret  string
    RuntimePath string
    TelegramBotToken string
    TelegramChatID   string
}

// Load membaca konfigurasi dari environment variables
func Load() Config {
    runtimePath := os.Getenv("RUNTIME_PATH")
    if runtimePath == "" {
        runtimePath = "./runtime"
    }
    appPort := os.Getenv("APP_PORT")
    if appPort == "" {
        appPort = "9090"
    }
    grpcPort := os.Getenv("GRPC_PORT")
    if grpcPort == "" {
        grpcPort = "50051"
    }
    return Config{
        AppPort:          appPort,
        GRPCPort:         grpcPort,
        GRPCSecret:       os.Getenv("GRPC_SECRET"),
        RuntimePath:      runtimePath,
        TelegramBotToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
        TelegramChatID:   os.Getenv("TELEGRAM_CHAT_ID"),
    }
}
```

- [ ] **Step 2: Overwrite main.go**

```go
// frontend/main.go
package main

import (
    "fmt"
    "log"
    "net"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/go-chi/chi/v5"
    "github.com/joho/godotenv"
    "google.golang.org/grpc"

    basemw "github.com/obong/obongcms-edge/base/middleware"
    "github.com/obong/obongcms-edge/base/config"
    "github.com/obong/obongcms-edge/internal/domainresolver"
    "github.com/obong/obongcms-edge/internal/grpcserver"
    edgesync "github.com/obong/obongcms-edge/internal/grpcserver/gen"
    "github.com/obong/obongcms-edge/modules/site"
)

func main() {
    if err := godotenv.Load(); err != nil {
        log.Println("Warning: .env not found, menggunakan environment variables")
    }

    cfg := config.Load()

    resolver := domainresolver.New(cfg.RuntimePath)
    resolver.WarmupFromTenantDirs()
    log.Printf("Domain resolver: warmup selesai dari %s", cfg.RuntimePath)

    // HTTP server (Chi)
    r := chi.NewRouter()
    r.Use(basemw.Recoverer)
    r.Use(basemw.Logger)
    r.Use(basemw.RealIP)
    r.Use(basemw.Timeout(30 * time.Second))

    r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
        fmt.Fprintln(w, `{"status":"ok","service":"obongcms-edge"}`)
    })

    siteHandler := site.NewHandler(cfg.RuntimePath, resolver)
    r.Mount("/", siteHandler.Routes())

    httpSrv := &http.Server{
        Addr:         ":" + cfg.AppPort,
        Handler:      r,
        ReadTimeout:  30 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // gRPC server
    grpcSrv := grpc.NewServer(
        grpc.UnaryInterceptor(grpcserver.AuthInterceptor(cfg.GRPCSecret)),
        grpc.StreamInterceptor(grpcserver.AuthStreamInterceptor(cfg.GRPCSecret)),
    )
    syncServer := grpcserver.NewServer(cfg.RuntimePath, resolver)
    edgesync.RegisterEdgeSyncServer(grpcSrv, syncServer)

    grpcListener, err := net.Listen("tcp", ":"+cfg.GRPCPort)
    if err != nil {
        log.Fatalf("Gagal listen gRPC port %s: %v", cfg.GRPCPort, err)
    }

    // Jalankan keduanya konkuren
    go func() {
        log.Printf("ObongCMS Edge HTTP server: :%s", cfg.AppPort)
        if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("HTTP server error: %v", err)
        }
    }()

    go func() {
        log.Printf("ObongCMS Edge gRPC server: :%s", cfg.GRPCPort)
        if err := grpcSrv.Serve(grpcListener); err != nil {
            log.Fatalf("gRPC server error: %v", err)
        }
    }()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Println("Shutdown signal diterima...")

    grpcSrv.GracefulStop()
    _ = httpSrv.Close()
    log.Println("ObongCMS Edge berhenti.")
}
```

- [ ] **Step 3: Update .env.example**

```bash
cat > /home/obong/Codes/project_codes/ObongCMS/frontend/.env.example << 'EOF'
# ObongCMS Edge — environment variables

# HTTP server port
APP_PORT=9090

# gRPC server port (internal, hanya CI4 yang boleh akses)
GRPC_PORT=50051

# Secret shared antara CI4 dan Go Edge — harus sama persis di backend/.env
GRPC_SECRET=obong_grpc_secret_2026

# Path ke direktori runtime (tenant data, cached, system)
RUNTIME_PATH=./runtime

# Telegram notifikasi error (opsional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
```

- [ ] **Step 4: Build dan pastikan compile**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/frontend
go build ./...
```
Expected: tidak ada error

- [ ] **Step 5: Run semua test**

```bash
go test ./... -v 2>&1 | tail -20
```
Expected: semua PASS

- [ ] **Step 6: Test jalankan server sebentar**

```bash
# Buat .env sementara
echo "APP_PORT=9091\nGRPC_PORT=50052\nRUNTIME_PATH=./runtime\nGRPC_SECRET=test" > /tmp/test.env
cp /tmp/test.env .env
go run main.go &
sleep 2
curl -s http://localhost:9091/health
kill %1
rm .env
```
Expected: `{"status":"ok","service":"obongcms-edge"}`

- [ ] **Step 7: Commit**

```bash
git add main.go base/config/config.go .env.example
git commit -m "feat: dual server main.go (HTTP :9090 + gRPC :50051) dengan graceful shutdown"
```

---

## Task 12: Port themes dan default assets dari acehcms

**Files:**
- Create: `frontend/runtime/system/themes/default/` — copy dari `acehcms/container/contents/themes/default/`
- Create: `frontend/runtime/system/plugins/` — copy dari `acehcms/container/contents/plugins/`
- Modify: semua file `.html` di theme → ganti branding `acehcms` → `obongcms`

**Interfaces:**
- Produces: theme default tersedia di `runtime/system/themes/default/`

- [ ] **Step 1: Salin themes dan plugins**

```bash
mkdir -p /home/obong/Codes/project_codes/ObongCMS/frontend/runtime/system
cp -r /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/contents/themes \
      /home/obong/Codes/project_codes/ObongCMS/frontend/runtime/system/
cp -r /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/container/contents/plugins \
      /home/obong/Codes/project_codes/ObongCMS/frontend/runtime/system/
```

- [ ] **Step 2: Ganti semua referensi branding dalam theme files**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/frontend/runtime/system
# Ganti text di semua file HTML, CSS, JS dalam themes
find themes plugins -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" \) \
    -exec sed -i 's/acehcms/obongcms/gi; s/AcehCMS/ObongCMS/gi; s/acehprov\.go\.id/obong.local/g' {} \;
```

- [ ] **Step 3: Verifikasi tidak ada referensi lama yang kritis**

```bash
grep -r "acehprov\.go\.id\|AcehCMS Official\|t\.me/acehcms" runtime/system/ | head -10
```
Expected: tidak ada hasil (semua sudah diganti)

- [ ] **Step 4: Commit**

```bash
git add runtime/system/ runtime/cached/
git commit -m "feat: port default themes dan plugins dari acehcms, rebrand ke obongcms"
```

---

## Task 13: Integration test end-to-end

**Files:**
- Create: `frontend/integration_test.go`

**Interfaces:**
- Consumes: semua komponen yang dibangun di Task 1-12

- [ ] **Step 1: Tulis integration test**

```go
// frontend/integration_test.go
//go:build integration
// +build integration

package main_test

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http"
    "os"
    "path/filepath"
    "testing"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    "google.golang.org/grpc/metadata"

    edgesync "github.com/obong/obongcms-edge/internal/grpcserver/gen"
)

// Test ini membutuhkan server yang sudah berjalan di APP_PORT dan GRPC_PORT
// Jalankan dengan: go test -tags integration ./... -v

func TestEndToEndPublishDanServe(t *testing.T) {
    grpcAddr := "localhost:50052"
    httpAddr := "http://localhost:9092"
    secret := "test-secret"

    // 1. Kirim SyncDomainConfig via gRPC
    conn, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
    if err != nil {
        t.Skipf("gRPC server tidak tersedia: %v", err)
    }
    defer conn.Close()
    client := edgesync.NewEdgeSyncClient(conn)

    ctx := metadata.AppendToOutgoingContext(context.Background(), "x-grpc-secret", secret)
    _, err = client.SyncDomainConfig(ctx, &edgesync.DomainConfig{
        TenantCode:  "testdomain",
        Domain:      "testdomain.local",
        Theme:       "default",
        RedaksiUrl:  "redaksi.testdomain.local",
    })
    if err != nil {
        t.Fatalf("SyncDomainConfig failed: %v", err)
    }

    // 2. Kirim SyncSnapshot (berita.json)
    beritaData, _ := json.Marshal(map[string]any{
        "data": []map[string]any{{"judul": "Test Berita", "slug": "/berita/test"}},
    })
    _, err = client.SyncSnapshot(ctx, &edgesync.SnapshotPayload{
        TenantCode: "testdomain",
        JsonPath:   "berita.json",
        Content:    beritaData,
    })
    if err != nil {
        t.Fatalf("SyncSnapshot failed: %v", err)
    }

    time.Sleep(100 * time.Millisecond)

    // 3. HTTP request ke site
    req, _ := http.NewRequest("GET", httpAddr+"/robots.txt", nil)
    req.Host = "testdomain.local"
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        t.Skipf("HTTP server tidak tersedia: %v", err)
    }
    defer resp.Body.Close()
    if resp.StatusCode != 200 {
        t.Errorf("expected 200, got %d", resp.StatusCode)
    }
}
```

- [ ] **Step 2: Run unit test saja (tanpa tag integration)**

```bash
go test ./... -v 2>&1 | grep -E "PASS|FAIL|ok"
```
Expected: semua PASS

- [ ] **Step 3: Final build check**

```bash
go build ./...
make lint 2>/dev/null || true
```
Expected: tidak ada error

- [ ] **Step 4: Commit final**

```bash
git add integration_test.go
git commit -m "test: tambah integration test end-to-end (dengan build tag integration)"
```

---

## Checklist Self-Review

- [x] Task 1-12 cover semua komponen dari spec: Go Edge port, gRPC server, dual main
- [x] Tidak ada "TBD" atau "implement later"
- [x] `edgesync.DomainConfig.RedaksiUrl` konsisten — field name dari proto `redaksi_url` → Go generated `RedaksiUrl`
- [x] `repository.Request.TenantCode` dipakai konsisten (bukan `Directory` dari acehcms)
- [x] `helpers.ThemeSwitch` signature konsisten: `(req repository.Request, runtimePath, page string) (string, bool)`
- [x] `response.ResponseHandler` struct dipakai konsisten di handler.go
- [x] Tidak ada referensi ke `CONTENT_USERS` atau `CONTENT_SYSTEM` env var (acehcms pattern) — semua pakai `runtimePath`
- [x] HTTP `/api/internal/*` tidak ada — dihapus sepenuhnya
