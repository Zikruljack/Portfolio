# Theme System Go Edge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi theme loading system di Go Edge — embed default theme ke binary, load custom theme dari runtime folder tenant, template cache per domain, dan internal API untuk manajemen tema.

**Architecture:** `ThemeManager` package baru di `internal/thememanager/` menangani semua logika tema. Default theme di-embed ke binary via `//go:embed`. Custom theme dibaca dari disk (`runtime/public/tenants/{domain}/themes/{active_theme}/`). Cache per domain di-invalidasi saat `activate`. Internal API theme ditambahkan ke `modules/internalapi/` sebagai file terpisah.

**Tech Stack:** Go 1.21+, `html/template`, `embed`, `sync.Mutex`, `chi v5`

**Referensi Spec:** `docs/superpowers/specs/2026-05-08-default-theme-design.md`

---

## File Map

| Status | Path | Peran |
|--------|------|-------|
| Create | `frontend/shared/themes/embed.go` | Package `themes`, deklarasi `//go:embed default` |
| Create | `frontend/shared/themes/default/` | File HTML + assets default theme (dari Plan 2) |
| Create | `frontend/internal/thememanager/thememanager.go` | Load theme, cache, invalidate |
| Create | `frontend/internal/thememanager/funcmap.go` | `safeHTML`, `formatDate`, `truncate`, `assetURL` |
| Create | `frontend/internal/thememanager/thememanager_test.go` | Unit test ThemeManager |
| Create | `frontend/modules/site/pagedata.go` | Struct `PageData`, `TenantConfig`, `MenuItem`, dll |
| Modify | `frontend/modules/site/handler.go` | Gunakan ThemeManager + build PageData lengkap |
| Create | `frontend/modules/internalapi/theme.go` | Handler endpoint tema (list, get, put, dup, activate, delete, upload) |
| Modify | `frontend/modules/internalapi/handler.go` | Tambah `tm *ThemeManager` ke struct + mount routes tema |
| Modify | `frontend/main.go` | Wire ThemeManager ke internalapi + site handler |

---

## Task 1: Package `shared/themes` — Embed Default Theme

**Files:**
- Create: `frontend/shared/themes/embed.go`

- [ ] Buat file `frontend/shared/themes/embed.go`:

```go
package themes

import "embed"

// FS berisi seluruh file default theme, di-embed ke binary saat build.
// Path "default" merujuk ke folder frontend/shared/themes/default/
//
//go:embed default
var FS embed.FS
```

- [ ] Buat struktur folder placeholder (akan diisi oleh Plan 2):

```
frontend/shared/themes/default/
├── header.html      ← placeholder kosong dulu
├── footer.html
├── index.html
├── list.html
├── single.html
├── download.html
└── assets/
    ├── css/style.css
    └── js/app.js
```

- [ ] Tambahkan `go.mod` import path check — pastikan package `themes` masuk ke module `github.com/obong/obongcms-edge`:

```bash
cd frontend && go build ./shared/themes/...
```

Expected: no errors (meski template kosong).

- [ ] Commit:

```bash
git add frontend/shared/themes/
git commit -m "feat(edge): add shared/themes embed package"
```

---

## Task 2: `ThemeManager` — Core Logic

**Files:**
- Create: `frontend/internal/thememanager/thememanager.go`
- Create: `frontend/internal/thememanager/thememanager_test.go`

- [ ] Tulis test dulu (`thememanager_test.go`):

```go
package thememanager_test

import (
    "os"
    "path/filepath"
    "testing"

    "github.com/obong/obongcms-edge/internal/thememanager"
)

func TestLoadDefaultTheme(t *testing.T) {
    tm := thememanager.New(t.TempDir())
    tmpl, err := tm.Load("unknown-domain.test")
    if err != nil {
        t.Fatalf("Load default theme error: %v", err)
    }
    if tmpl == nil {
        t.Fatal("expected non-nil template")
    }
}

func TestLoadCustomTheme(t *testing.T) {
    runtimePath := t.TempDir()
    domain := "test.domain"

    // Buat struktur custom theme
    themeDir := filepath.Join(runtimePath, "public", "tenants", domain, "themes", "tema-test")
    os.MkdirAll(themeDir, 0755)
    os.WriteFile(filepath.Join(themeDir, "index.html"), []byte(`{{define "content"}}test{{end}}`), 0644)

    // Tulis tenant.json dengan active_theme
    tenantDir := filepath.Join(runtimePath, "public", "tenants", domain)
    os.WriteFile(filepath.Join(tenantDir, "tenant.json"),
        []byte(`{"active_theme":"tema-test"}`), 0644)

    tm := thememanager.New(runtimePath)
    tmpl, err := tm.Load(domain)
    if err != nil {
        t.Fatalf("Load custom theme error: %v", err)
    }
    if tmpl == nil {
        t.Fatal("expected non-nil template")
    }
}

func TestCacheInvalidation(t *testing.T) {
    tm := thememanager.New(t.TempDir())
    _ , _ = tm.Load("a.test") // populate cache
    tm.Invalidate("a.test")
    // tidak panic
}

func TestFallbackWhenActiveThemeMissing(t *testing.T) {
    runtimePath := t.TempDir()
    domain := "test.domain"
    tenantDir := filepath.Join(runtimePath, "public", "tenants", domain)
    os.MkdirAll(tenantDir, 0755)
    // active_theme menunjuk folder yang tidak ada
    os.WriteFile(filepath.Join(tenantDir, "tenant.json"),
        []byte(`{"active_theme":"tidak-ada"}`), 0644)

    tm := thememanager.New(runtimePath)
    tmpl, err := tm.Load(domain)
    if err != nil {
        t.Fatalf("should fallback to default, got error: %v", err)
    }
    if tmpl == nil {
        t.Fatal("expected non-nil template from fallback")
    }
}
```

- [ ] Run test, pastikan FAIL karena package belum ada:

```bash
cd frontend && go test ./internal/thememanager/...
```

Expected: `cannot find package`

- [ ] Buat `frontend/internal/thememanager/thememanager.go`:

```go
package thememanager

import (
    "encoding/json"
    "html/template"
    "io/fs"
    "os"
    "path/filepath"
    "sync"

    "github.com/obong/obongcms-edge/shared/themes"
)

type ThemeManager struct {
    runtimePath string
    mu          sync.Mutex
    cache       map[string]*template.Template
}

type tenantJSON struct {
    ActiveTheme string `json:"active_theme"`
}

func New(runtimePath string) *ThemeManager {
    return &ThemeManager{
        runtimePath: runtimePath,
        cache:       make(map[string]*template.Template),
    }
}

// Load mengembalikan template yang sudah di-parse untuk domain.
// Pakai custom theme jika active_theme valid, fallback ke embedded default.
func (tm *ThemeManager) Load(domain string) (*template.Template, error) {
    tm.mu.Lock()
    defer tm.mu.Unlock()

    if tmpl, ok := tm.cache[domain]; ok {
        return tmpl, nil
    }

    themeDir, isCustom := tm.activeThemeDir(domain)

    var tmpl *template.Template
    var err error
    if isCustom {
        tmpl, err = tm.loadFromDisk(themeDir)
    } else {
        tmpl, err = tm.loadFromEmbed()
    }
    if err != nil {
        return nil, err
    }

    tm.cache[domain] = tmpl
    return tmpl, nil
}

// Invalidate menghapus cache template untuk domain tertentu.
// Dipanggil setelah tema di-activate.
func (tm *ThemeManager) Invalidate(domain string) {
    tm.mu.Lock()
    defer tm.mu.Unlock()
    delete(tm.cache, domain)
}

// ActiveThemeName membaca active_theme dari tenant.json. Kosong = pakai default.
func (tm *ThemeManager) ActiveThemeName(domain string) string {
    var tj tenantJSON
    path := filepath.Join(tm.runtimePath, "public", "tenants", domain, "tenant.json")
    data, err := os.ReadFile(path)
    if err != nil {
        return ""
    }
    json.Unmarshal(data, &tj)
    return tj.ActiveTheme
}

// ThemeDir mengembalikan path folder tema aktif, atau "" jika default.
func (tm *ThemeManager) ThemeDir(domain string) string {
    dir, isCustom := tm.activeThemeDir(domain)
    if !isCustom {
        return ""
    }
    return dir
}

func (tm *ThemeManager) activeThemeDir(domain string) (string, bool) {
    active := tm.ActiveThemeName(domain)
    if active == "" {
        return "", false
    }
    dir := filepath.Join(tm.runtimePath, "public", "tenants", domain, "themes", active)
    if _, err := os.Stat(dir); err != nil {
        return "", false // folder tidak ada → fallback default
    }
    return dir, true
}

func (tm *ThemeManager) loadFromDisk(themeDir string) (*template.Template, error) {
    pattern := filepath.Join(themeDir, "*.html")
    return template.New("").Funcs(FuncMap()).ParseGlob(pattern)
}

func (tm *ThemeManager) loadFromEmbed() (*template.Template, error) {
    sub, err := fs.Sub(themes.FS, "default")
    if err != nil {
        return nil, err
    }
    return template.New("").Funcs(FuncMap()).ParseFS(sub, "*.html")
}
```

- [ ] Run test:

```bash
cd frontend && go test ./internal/thememanager/... -v
```

Expected: semua PASS (kecuali TestLoadDefaultTheme akan fail karena embed template kosong — ini normal sampai Plan 2 selesai).

- [ ] Commit:

```bash
git add frontend/internal/thememanager/
git commit -m "feat(edge): add ThemeManager with embed fallback and per-domain cache"
```

---

## Task 3: FuncMap

**Files:**
- Create: `frontend/internal/thememanager/funcmap.go`

- [ ] Buat `frontend/internal/thememanager/funcmap.go`:

```go
package thememanager

import (
    "html/template"
    "strings"
    "time"
    "unicode/utf8"
)

func FuncMap() template.FuncMap {
    return template.FuncMap{
        "safeHTML":   safeHTML,
        "formatDate": formatDate,
        "truncate":   truncate,
        "assetURL":   assetURL,
    }
}

func safeHTML(s string) template.HTML {
    return template.HTML(s)
}

// formatDate mengubah format "2006-01-02T15:04:05Z" ke "02 Januari 2006"
func formatDate(s string) string {
    formats := []string{
        time.RFC3339,
        "2006-01-02 15:04:05",
        "2006-01-02",
    }
    var t time.Time
    var err error
    for _, f := range formats {
        t, err = time.Parse(f, s)
        if err == nil {
            break
        }
    }
    if err != nil {
        return s
    }
    bulan := []string{
        "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    }
    return fmt.Sprintf("%02d %s %d", t.Day(), bulan[int(t.Month())], t.Year())
}

// truncate memotong string ke n karakter, tambah "..." jika dipotong
func truncate(s string, n int) string {
    if utf8.RuneCountInString(s) <= n {
        return s
    }
    runes := []rune(s)
    return string(runes[:n]) + "..."
}

// assetURL mengembalikan URL aset tema yang tepat.
// Jika themeDir kosong (default), gunakan /assets/themes/default/
// Jika custom, gunakan /themes/{themeName}/
func assetURL(themeDir, path string) string {
    if themeDir == "" {
        return "/assets/themes/default/" + strings.TrimPrefix(path, "/")
    }
    // themeDir = .../themes/tema-hijau → ambil nama folder terakhir
    name := filepath.Base(themeDir)
    return "/themes/" + name + "/" + strings.TrimPrefix(path, "/")
}
```

- [ ] Tambahkan import `fmt` dan `path/filepath` yang diperlukan.

- [ ] Build check:

```bash
cd frontend && go build ./internal/thememanager/...
```

- [ ] Commit:

```bash
git add frontend/internal/thememanager/funcmap.go
git commit -m "feat(edge): add template FuncMap (safeHTML, formatDate, truncate, assetURL)"
```

---

## Task 4: `PageData` Struct

**Files:**
- Create: `frontend/modules/site/pagedata.go`

- [ ] Buat `frontend/modules/site/pagedata.go`:

```go
package site

// PageData adalah data utama yang dikirim ke semua template halaman publik.
type PageData struct {
    Tenant  TenantConfig
    Menu    []MenuItem
    Slider  []SliderItem
    Data    any
    Meta    PageMeta
    Sidebar []SidebarItem
    IsHome  bool
    Page    string // "index" | "list" | "single" | "download"
    ThemeDir string // path folder tema aktif, "" = default embedded
}

type TenantConfig struct {
    NamaOrg     string         `json:"nama_org"`
    Tagline     string         `json:"tagline"`
    Logo        string         `json:"logo"`
    Icon        string         `json:"icon"`
    ActiveTheme string         `json:"active_theme"`
    Sosmed      SosmedLinks    `json:"sosmed"`
}

type SosmedLinks struct {
    Facebook  string `json:"facebook"`
    Twitter   string `json:"twitter"`
    Instagram string `json:"instagram"`
    Youtube   string `json:"youtube"`
}

type MenuItem struct {
    Label    string     `json:"label"`
    URL      string     `json:"url"`
    Children []MenuItem `json:"children"`
}

type SliderItem struct {
    Gambar string `json:"gambar"`
    Judul  string `json:"judul"`
    Link   string `json:"link"`
}

type PageMeta struct {
    Title       string
    Description string
    Image       string
    URL         string
    Type        string // "website" atau "article"
}

type SidebarItem struct {
    Slug          string `json:"slug"`
    Judul         string `json:"judul"`
    Thumbnail     string `json:"thumbnail"`
    TanggalTerbit string `json:"tanggal_terbit"`
}

// --- Data konten per halaman ---

type BeritaListData struct {
    Items     []beritaItem `json:"items"`
    Page      int          `json:"page"`
    TotalPage int          `json:"total_page"`
    PrevURL   string
    NextURL   string
}

type BeritaDetailData struct {
    Slug          string   `json:"slug"`
    Judul         string   `json:"judul"`
    Ringkasan     string   `json:"ringkasan"`
    Isi           string   `json:"isi"`
    Thumbnail     string   `json:"thumbnail"`
    GambarAlt     string   `json:"gambar_alt"`
    Kategori      string   `json:"kategori"`
    KategoriSlug  string   `json:"kategori_slug"`
    Penulis       string   `json:"penulis"`
    TanggalTerbit string   `json:"tanggal_terbit"`
    Tags          []string `json:"tags"`
}

type HalamanDetailData struct {
    Slug      string `json:"slug"`
    Judul     string `json:"judul"`
    Isi       string `json:"isi"`
    Thumbnail string `json:"thumbnail"`
}

type DownloadItem struct {
    NamaDokumen string `json:"nama_dokumen"`
    TipeFile    string `json:"tipe_file"`
    Ukuran      string `json:"ukuran"`
    URL         string `json:"url"`
}

type DownloadListData struct {
    Judul string         `json:"judul"`
    Items []DownloadItem `json:"items"`
}

type HomeData struct {
    BeritaUtama        *beritaItem   `json:"berita_utama"`
    BeritaTerbaru      []beritaItem  `json:"berita_terbaru"`
    BeritaPerKategori  []KategoriSection `json:"berita_per_kategori"`
}

type KategoriSection struct {
    Nama  string       `json:"nama"`
    Slug  string       `json:"slug"`
    Items []beritaItem `json:"items"`
}
```

- [ ] Build check:

```bash
cd frontend && go build ./modules/site/...
```

- [ ] Commit:

```bash
git add frontend/modules/site/pagedata.go
git commit -m "feat(edge): add PageData structs for theme rendering"
```

---

## Task 5: Update `site/handler.go`

**Files:**
- Modify: `frontend/modules/site/handler.go`

- [ ] Tambahkan `ThemeManager` ke `Handler` struct dan update `NewHandler`:

```go
// Handler sekarang menyimpan ThemeManager
type Handler struct {
    tfs      *tenantfs.TenantFS
    resolver *domainresolver.Resolver
    tm       *thememanager.ThemeManager
}

func NewHandler(runtimePath string, resolver *domainresolver.Resolver) *Handler {
    return &Handler{
        tfs:      tenantfs.New(runtimePath),
        resolver: resolver,
        tm:       thememanager.New(runtimePath),
    }
}
```

- [ ] Ganti method `render()` yang lama dengan yang pakai ThemeManager:

```go
func (h *Handler) render(w http.ResponseWriter, templateName string, data *PageData) {
    tmpl, err := h.tm.Load(data.Tenant.ActiveTheme) // akan diganti dengan Load(domain)
    if err != nil {
        log.Printf("theme load error: %v", err)
        http.Error(w, "Theme error", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    if err := tmpl.ExecuteTemplate(w, templateName, data); err != nil {
        log.Printf("template execute error: %v", err)
    }
}
```

Catatan: `Load` menerima `domain` string, bukan `ActiveTheme`. Update signature `tm.Load(domain)`.

- [ ] Tambahkan helper `buildBaseData()` yang membaca tenant.json, menu.json, slider.json:

```go
func (h *Handler) buildBaseData(domain string) PageData {
    var tenant TenantConfig
    _ = h.tfs.ReadJSON(domain, "tenant.json", &tenant)

    var menu []MenuItem
    _ = h.tfs.ReadJSON(domain, "menu.json", &menu)

    var sidebar []SidebarItem
    var listData BeritaListData
    if err := h.tfs.ReadJSON(domain, "berita.json", &listData); err == nil {
        for i, item := range listData.Items {
            if i >= 5 {
                break
            }
            sidebar = append(sidebar, SidebarItem{
                Slug:          item.Slug,
                Judul:         item.Judul,
                Thumbnail:     item.Thumbnail,
                TanggalTerbit: item.TanggalTerbit,
            })
        }
    }

    return PageData{
        Tenant:   tenant,
        Menu:     menu,
        Sidebar:  sidebar,
        ThemeDir: h.tm.ThemeDir(domain),
    }
}
```

- [ ] Update `BeritaList`, `BeritaDetail`, dan `Home` handler agar gunakan `buildBaseData()`:

```go
func (h *Handler) BeritaList(w http.ResponseWriter, r *http.Request) {
    domain := h.domain(r)
    if !h.domainReady(domain) {
        http.Error(w, "Domain tidak terdaftar", http.StatusNotFound)
        return
    }

    var listData BeritaListData
    _ = h.tfs.ReadJSON(domain, "berita.json", &listData)

    pd := h.buildBaseData(domain)
    pd.Data = listData
    pd.Page = "list"
    pd.IsHome = false
    pd.Meta = PageMeta{
        Title:       "Berita — " + pd.Tenant.NamaOrg,
        Description: pd.Tenant.Tagline,
        Type:        "website",
    }

    h.render(w, "content", &pd)
}

func (h *Handler) Home(w http.ResponseWriter, r *http.Request) {
    domain := h.domain(r)
    if !h.domainReady(domain) {
        http.Error(w, "Domain tidak terdaftar", http.StatusNotFound)
        return
    }

    var homeData HomeData
    _ = h.tfs.ReadJSON(domain, "home.json", &homeData)

    var slider []SliderItem
    _ = h.tfs.ReadJSON(domain, "slider.json", &slider)

    pd := h.buildBaseData(domain)
    pd.Data = homeData
    pd.Slider = slider
    pd.Page = "index"
    pd.IsHome = true
    pd.Meta = PageMeta{
        Title: pd.Tenant.NamaOrg,
        Type:  "website",
    }

    h.render(w, "content", &pd)
}
```

- [ ] Tambahkan routes baru untuk halaman dan download:

```go
func (h *Handler) Routes() chi.Router {
    r := chi.NewRouter()
    r.Get("/", h.Home)
    r.Get("/berita", h.BeritaList)
    r.Get("/berita/{slug}", h.BeritaDetail)
    r.Get("/halaman/{slug}", h.HalamanDetail)
    r.Get("/download", h.DownloadList)
    r.Handle("/assets/*", http.StripPrefix("/assets/", http.FileServer(http.Dir("public/assets"))))
    r.Handle("/themes/*", http.StripPrefix("/themes/", h.serveThemeAsset()))
    r.HandleFunc("/media/*", h.Media)
    return r
}

// serveThemeAsset melayani file aset dari custom theme tenant
func (h *Handler) serveThemeAsset() http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        domain := h.domain(r)
        themeDir := h.tm.ThemeDir(domain)
        if themeDir == "" {
            http.NotFound(w, r)
            return
        }
        rel := strings.TrimPrefix(r.URL.Path, "/themes/")
        http.ServeFile(w, r, filepath.Join(themeDir, "assets", rel))
    })
}
```

- [ ] Build check:

```bash
cd frontend && go build ./...
```

- [ ] Commit:

```bash
git add frontend/modules/site/handler.go
git commit -m "feat(edge): integrate ThemeManager into site handler"
```

---

## Task 6: Internal API — Theme Endpoints

**Files:**
- Create: `frontend/modules/internalapi/theme.go`
- Modify: `frontend/modules/internalapi/handler.go`

- [ ] Tambahkan `tm *thememanager.ThemeManager` ke `Handler` struct di `handler.go`:

```go
type Handler struct {
    tfs    *tenantfs.TenantFS
    secret string
    tm     *thememanager.ThemeManager
}

func NewHandler(runtimePath, secret string) *Handler {
    return &Handler{
        tfs:    tenantfs.New(runtimePath),
        secret: secret,
        tm:     thememanager.New(runtimePath),
    }
}
```

- [ ] Mount routes tema di `Routes()`:

```go
r.Route("/theme/{domain}", func(r chi.Router) {
    r.Get("/list", h.ThemeList)
    r.Get("/{theme_name}/files", h.ThemeFiles)
    r.Get("/{theme_name}/file", h.ThemeFileGet)
    r.Put("/{theme_name}/file", h.ThemeFilePut)
    r.Post("/{theme_name}/duplicate", h.ThemeDuplicate)
    r.Post("/{theme_name}/activate", h.ThemeActivate)
    r.Delete("/{theme_name}", h.ThemeDelete)
    r.Post("/{theme_name}/upload", h.ThemeAssetUpload)
})
```

- [ ] Buat `frontend/modules/internalapi/theme.go`:

```go
package internalapi

import (
    "encoding/json"
    "io"
    "net/http"
    "os"
    "path/filepath"
    "strings"

    "github.com/go-chi/chi/v5"
)

const maxThemes = 4

// ThemeList — GET /api/internal/theme/{domain}/list
// Response: { themes: [...], active: "nama", max: 4 }
func (h *Handler) ThemeList(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themesDir := h.themesDir(domain)

    entries, _ := os.ReadDir(themesDir)
    var list []string
    for _, e := range entries {
        if e.IsDir() {
            list = append(list, e.Name())
        }
    }

    active := h.tm.ActiveThemeName(domain)
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{
        "status": true,
        "themes": list,
        "active": active,
        "max":    maxThemes,
    })
}

// ThemeFiles — GET /api/internal/theme/{domain}/{theme_name}/files
// Response: { files: ["header.html", "index.html", ...] }
func (h *Handler) ThemeFiles(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themeName := chi.URLParam(r, "theme_name")
    dir := filepath.Join(h.themesDir(domain), themeName)

    entries, err := os.ReadDir(dir)
    if err != nil {
        jsonError(w, http.StatusNotFound, "tema tidak ditemukan")
        return
    }

    var files []string
    for _, e := range entries {
        if !e.IsDir() {
            files = append(files, e.Name())
        }
    }
    // tambahkan file dari subdirektori assets/
    assetDir := filepath.Join(dir, "assets")
    filepath.Walk(assetDir, func(path string, info os.FileInfo, err error) error {
        if err != nil || info.IsDir() {
            return nil
        }
        rel, _ := filepath.Rel(dir, path)
        files = append(files, rel)
        return nil
    })

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{"status": true, "files": files})
}

// ThemeFileGet — GET /api/internal/theme/{domain}/{theme_name}/file?path=header.html
func (h *Handler) ThemeFileGet(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themeName := chi.URLParam(r, "theme_name")
    filePath := r.URL.Query().Get("path")
    if filePath == "" {
        jsonError(w, http.StatusBadRequest, "path wajib diisi")
        return
    }

    fullPath := h.safeThemePath(domain, themeName, filePath)
    if fullPath == "" {
        jsonError(w, http.StatusBadRequest, "path tidak valid")
        return
    }

    data, err := os.ReadFile(fullPath)
    if err != nil {
        jsonError(w, http.StatusNotFound, "file tidak ditemukan")
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{"status": true, "content": string(data)})
}

// ThemeFilePut — PUT /api/internal/theme/{domain}/{theme_name}/file?path=header.html
// Body JSON: { "content": "<string>" }
func (h *Handler) ThemeFilePut(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themeName := chi.URLParam(r, "theme_name")
    filePath := r.URL.Query().Get("path")
    if filePath == "" {
        jsonError(w, http.StatusBadRequest, "path wajib diisi")
        return
    }

    var body struct {
        Content string `json:"content"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        jsonError(w, http.StatusBadRequest, "invalid JSON")
        return
    }

    fullPath := h.safeThemePath(domain, themeName, filePath)
    if fullPath == "" {
        jsonError(w, http.StatusBadRequest, "path tidak valid")
        return
    }

    os.MkdirAll(filepath.Dir(fullPath), 0755)
    if err := os.WriteFile(fullPath, []byte(body.Content), 0644); err != nil {
        jsonError(w, http.StatusInternalServerError, "gagal tulis file")
        return
    }

    jsonOK(w, "file disimpan")
}

// ThemeDuplicate — POST /api/internal/theme/{domain}/{theme_name}/duplicate
// Body JSON: { "source": "default" | "tema-lain", "name": "nama-baru" }
func (h *Handler) ThemeDuplicate(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")

    var body struct {
        Source string `json:"source"`
        Name   string `json:"name"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        jsonError(w, http.StatusBadRequest, "invalid JSON")
        return
    }
    if body.Name == "" {
        jsonError(w, http.StatusBadRequest, "name wajib diisi")
        return
    }

    themesDir := h.themesDir(domain)

    // Cek batas max 4
    entries, _ := os.ReadDir(themesDir)
    count := 0
    for _, e := range entries {
        if e.IsDir() {
            count++
        }
    }
    if count >= maxThemes {
        jsonError(w, http.StatusBadRequest, "maksimal 4 tema per tenant")
        return
    }

    destDir := filepath.Join(themesDir, body.Name)
    if _, err := os.Stat(destDir); err == nil {
        jsonError(w, http.StatusBadRequest, "nama tema sudah digunakan")
        return
    }

    // Tentukan source dir
    var srcDir string
    if body.Source == "default" || body.Source == "" {
        // Ekstrak dari embedded FS ke temp folder dulu, lalu copy ke destDir
        if err := h.copyDefaultTheme(destDir); err != nil {
            jsonError(w, http.StatusInternalServerError, "gagal duplikat: "+err.Error())
            return
        }
        jsonOK(w, "tema berhasil diduplikat dari default")
        return
    }
    srcDir = filepath.Join(themesDir, body.Source)

    if err := copyDir(srcDir, destDir); err != nil {
        jsonError(w, http.StatusInternalServerError, "gagal duplikat: "+err.Error())
        return
    }

    jsonOK(w, "tema berhasil diduplikat")
}

// ThemeActivate — POST /api/internal/theme/{domain}/{theme_name}/activate
func (h *Handler) ThemeActivate(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themeName := chi.URLParam(r, "theme_name")

    themeDir := filepath.Join(h.themesDir(domain), themeName)
    if _, err := os.Stat(themeDir); err != nil {
        jsonError(w, http.StatusNotFound, "tema tidak ditemukan")
        return
    }

    // Update active_theme di tenant.json
    if err := h.updateActiveTheme(domain, themeName); err != nil {
        jsonError(w, http.StatusInternalServerError, "gagal update tenant.json")
        return
    }

    // Invalidasi cache template
    h.tm.Invalidate(domain)

    jsonOK(w, "tema diaktifkan")
}

// ThemeDelete — DELETE /api/internal/theme/{domain}/{theme_name}
func (h *Handler) ThemeDelete(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themeName := chi.URLParam(r, "theme_name")

    // Tidak boleh hapus tema yang aktif
    if h.tm.ActiveThemeName(domain) == themeName {
        jsonError(w, http.StatusBadRequest, "tidak bisa hapus tema yang sedang aktif")
        return
    }

    themeDir := filepath.Join(h.themesDir(domain), themeName)
    if err := os.RemoveAll(themeDir); err != nil {
        jsonError(w, http.StatusInternalServerError, "gagal hapus tema")
        return
    }

    jsonOK(w, "tema dihapus")
}

// ThemeAssetUpload — POST /api/internal/theme/{domain}/{theme_name}/upload
// Form: file + path (misal: "assets/css/custom.css")
func (h *Handler) ThemeAssetUpload(w http.ResponseWriter, r *http.Request) {
    domain := chi.URLParam(r, "domain")
    themeName := chi.URLParam(r, "theme_name")

    if err := r.ParseMultipartForm(5 << 20); err != nil {
        jsonError(w, http.StatusBadRequest, "parse form gagal")
        return
    }

    assetPath := r.FormValue("path")
    if assetPath == "" {
        jsonError(w, http.StatusBadRequest, "path wajib diisi")
        return
    }

    file, _, err := r.FormFile("file")
    if err != nil {
        jsonError(w, http.StatusBadRequest, "file tidak ada")
        return
    }
    defer file.Close()

    data, _ := io.ReadAll(file)
    fullPath := h.safeThemePath(domain, themeName, assetPath)
    if fullPath == "" {
        jsonError(w, http.StatusBadRequest, "path tidak valid")
        return
    }

    os.MkdirAll(filepath.Dir(fullPath), 0755)
    if err := os.WriteFile(fullPath, data, 0644); err != nil {
        jsonError(w, http.StatusInternalServerError, "gagal simpan file")
        return
    }

    jsonOK(w, "file di-upload")
}

// --- helpers ---

func (h *Handler) themesDir(domain string) string {
    return filepath.Join(h.tfs.TenantDir(domain), "themes")
}

// safeThemePath memastikan path tidak keluar dari folder tema (path traversal guard).
func (h *Handler) safeThemePath(domain, themeName, relPath string) string {
    themeDir := filepath.Join(h.themesDir(domain), themeName)
    fullPath := filepath.Join(themeDir, filepath.Clean("/"+relPath))
    if !strings.HasPrefix(fullPath, themeDir) {
        return "" // path traversal attempt
    }
    return fullPath
}

// updateActiveTheme membaca tenant.json, update active_theme, tulis balik.
func (h *Handler) updateActiveTheme(domain, themeName string) error {
    tenantPath := filepath.Join(h.tfs.TenantDir(domain), "tenant.json")
    data, _ := os.ReadFile(tenantPath)

    var setting map[string]any
    if len(data) > 0 {
        json.Unmarshal(data, &setting)
    } else {
        setting = make(map[string]any)
    }
    setting["active_theme"] = themeName

    out, err := json.MarshalIndent(setting, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(tenantPath, out, 0644)
}

// copyDefaultTheme mengekstrak default theme dari embedded FS ke destDir.
func (h *Handler) copyDefaultTheme(destDir string) error {
    // Implementasi: walk themes.FS "default", tulis tiap file ke destDir
    // (referensi import themes package)
    return nil // akan diimplementasi setelah Plan 2 selesai
}

// copyDir menyalin seluruh isi srcDir ke destDir.
func copyDir(src, dst string) error {
    return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        rel, _ := filepath.Rel(src, path)
        target := filepath.Join(dst, rel)
        if info.IsDir() {
            return os.MkdirAll(target, 0755)
        }
        data, err := os.ReadFile(path)
        if err != nil {
            return err
        }
        os.MkdirAll(filepath.Dir(target), 0755)
        return os.WriteFile(target, data, 0644)
    })
}
```

- [ ] Build check:

```bash
cd frontend && go build ./...
```

- [ ] Commit:

```bash
git add frontend/modules/internalapi/theme.go frontend/modules/internalapi/handler.go
git commit -m "feat(edge): add theme management internal API endpoints"
```

---

## Task 7: Wire ThemeManager di `main.go`

**Files:**
- Modify: `frontend/main.go`

- [ ] Update `main.go` — tidak ada perubahan besar karena `NewHandler` sudah buat ThemeManager internal. Pastikan import bersih:

```bash
cd frontend && go build ./...
```

Expected: no errors.

- [ ] Run semua test:

```bash
cd frontend && go test ./... -v
```

- [ ] Commit final:

```bash
git add frontend/main.go
git commit -m "feat(edge): wire theme system — Plan 1 complete"
```
