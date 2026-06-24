# Design Spec: Default Theme & Theme System ObongCMS

**Tanggal**: 2026-05-08  
**Status**: Draft — menunggu approval  
**Scope**: Default theme Go Edge + theme management system (max 4 tema per tenant)

---

## 1. Gambaran Umum

ObongCMS mendukung sistem tema per-tenant dengan aturan:

- **Default theme**: embedded dalam binary Go (`//go:embed`) — read-only, tidak bisa diedit siapapun
- **Custom theme**: duplikat dari default, disimpan di runtime folder tenant — bisa diedit via themes editor di Redaksi
- **Max 4 custom theme** per tenant — tenant bisa hapus tema untuk membuat slot baru
- **Active theme**: hanya 1 tema yang aktif dalam satu waktu, ditentukan oleh field `active_theme` di `tenant.json`
- **Edit = aktif tema**: themes editor di Redaksi hanya bisa edit tema yang sedang aktif
- **Fallback**: jika `active_theme` kosong/null atau folder tidak ada → Go Edge pakai default (embedded)

---

## 2. Struktur File

### Default Theme (Embedded Binary)

```
frontend/shared/themes/default/
├── header.html          ← {{define "header"}}
├── footer.html          ← {{define "footer"}}
├── index.html           ← {{define "content"}} home
├── list.html            ← {{define "content"}} daftar berita/kategori
├── single.html          ← {{define "content"}} detail berita/halaman
├── download.html        ← {{define "content"}} daftar dokumen
└── assets/
    ├── css/style.css    ← CSS custom, pakai CSS variables
    └── js/app.js        ← vanilla JS
```

Di-embed ke binary:
```go
//go:embed shared/themes/default
var defaultThemeFS embed.FS
```

### Custom Theme (Runtime — Per Tenant)

```
runtime/public/tenants/{domain}/
├── tenant.json                    ← { "active_theme": "tema-hijau", ... }
└── themes/
    ├── tema-hijau/                ← aktif, yang dirender Go Edge
    │   ├── header.html
    │   ├── footer.html
    │   ├── index.html
    │   ├── list.html
    │   ├── single.html
    │   ├── download.html
    │   └── assets/
    │       ├── css/style.css
    │       └── js/app.js
    ├── tema-biru/                 ← ada tapi tidak aktif
    └── (max 4 folder total)
```

---

## 3. Alur Go Edge: Theme Loading

```
Request masuk → domain acehprov.go.id
    │
    ├── Baca tenant.json → active_theme: "tema-hijau"
    │
    ├── Cek: runtime/tenants/acehprov.go.id/themes/tema-hijau/ ada?
    │   ├── Ya  → load template dari folder itu (template.ParseGlob disk)
    │   └── Tidak / active_theme kosong → load dari embedded FS (defaultThemeFS)
    │
    ├── Baca JSON data tenant:
    │   ├── tenant.json  → TenantConfig{}
    │   ├── menu.json    → []MenuItem{}
    │   ├── slider.json  → []SliderItem{}   (index only)
    │   └── berita.json / berita/{slug}.json / halaman/{slug}.json / download.json
    │
    ├── Build PageData struct
    │
    └── tmpl.ExecuteTemplate(w, "content", pageData)
```

Template cache di-invalidasi per domain setiap kali ada `activate` signal dari CI4.

---

## 4. Data Template

```go
type PageData struct {
    Tenant  TenantConfig  // dari tenant.json
    Menu    []MenuItem    // dari menu.json
    Slider  []SliderItem  // dari slider.json (index only)
    Data    interface{}   // konten halaman (berita/halaman/dokumen)
    Meta    PageMeta      // title, description, og:image, url
    Sidebar []SidebarItem // berita terbaru untuk sidebar
    IsHome  bool          // true hanya di index — kontrol slider di header
    Page    string        // "index" | "list" | "single" | "download"
}

type TenantConfig struct {
    NamaOrg     string
    Tagline     string
    Logo        string
    Icon        string
    ActiveTheme string
    Sosmed      SosmedLinks
}

type PageMeta struct {
    Title       string
    Description string
    Image       string
    URL         string
    Type        string // "website" atau "article"
}
```

---

## 5. Template Functions (FuncMap)

| Fungsi | Signature | Kegunaan |
|--------|-----------|----------|
| `safeHTML` | `func(string) template.HTML` | Render HTML konten berita |
| `formatDate` | `func(string) string` | Format tanggal ke "02 Jan 2006" |
| `truncate` | `func(string, int) string` | Potong teks untuk excerpt |
| `assetURL` | `func(domain, path string) string` | URL aset tema aktif |

---

## 6. Internal API Go Edge — Theme Management

Semua operasi tema dilakukan oleh Go Edge atas permintaan CI4. CI4 tidak pernah menulis langsung ke filesystem Go Edge.

Auth: header `X-Internal-Key` (sama dengan internal API yang sudah ada).

### Baca & Edit File Tema

```
GET  /internal/theme/{domain}/list
     Response: { themes: ["tema-hijau", "tema-biru"], active: "tema-hijau", max: 4 }

GET  /internal/theme/{domain}/{theme_name}/files
     Response: { files: ["header.html", "footer.html", "index.html", ...] }

GET  /internal/theme/{domain}/{theme_name}/file?path=header.html
     Response: { content: "<string isi file>" }

PUT  /internal/theme/{domain}/{theme_name}/file?path=header.html
     Body: { content: "<string isi file>" }
     Response: { ok: true }
     → Go Edge tulis file ke disk, tidak invalidasi cache (baru aktif setelah activate)
```

### Manajemen Tema

```
POST /internal/theme/{domain}/duplicate
     Body: { source: "default" | "tema-hijau", name: "tema-baru" }
     Response: { ok: true } | { error: "max 4 themes reached" }
     → Go Edge copy semua file source ke folder tema baru

POST /internal/theme/{domain}/{theme_name}/activate
     Response: { ok: true }
     → Go Edge update active_theme di tenant.json
     → Go Edge invalidasi template cache domain ini

DELETE /internal/theme/{domain}/{theme_name}
     Response: { ok: true } | { error: "cannot delete active theme" }
     → Tidak bisa hapus tema yang sedang aktif
     → Go Edge hapus folder tema

POST /internal/theme/{domain}/{theme_name}/upload
     Body: multipart/form-data, field "file", field "path" (contoh: "assets/css/custom.css")
     Response: { ok: true, url: "/themes/{theme_name}/assets/css/custom.css" }
     → Go Edge simpan file ke folder assets tema
```

---

## 7. Alur Themes Editor di Redaksi (CI4)

```
User buka Themes Editor
    │
    ├── CI4 GET /internal/theme/{domain}/list
    │   → tampil daftar tema (max 4), highlight mana yang aktif
    │
    ├── Tombol "Edit Tema Aktif"
    │   ├── CI4 GET /internal/theme/{domain}/{active_theme}/files
    │   ├── User pilih file (header.html, style.css, dll)
    │   ├── CI4 GET /internal/theme/{domain}/{active_theme}/file?path=...
    │   │   → tampil di code editor (Monaco/CodeMirror)
    │   └── User save → CI4 PUT /internal/theme/{domain}/{active_theme}/file?path=...
    │
    ├── Tombol "Duplikat Tema"
    │   ├── Pilih source (default atau tema yang ada)
    │   ├── Isi nama tema baru
    │   └── CI4 POST /internal/theme/{domain}/duplicate
    │
    ├── Tombol "Aktifkan"
    │   └── CI4 POST /internal/theme/{domain}/{theme_name}/activate
    │       → Go Edge reload cache, situs langsung pakai tema baru
    │
    ├── Tombol "Upload Asset"
    │   └── CI4 POST /internal/theme/{domain}/{active_theme}/upload
    │
    └── Tombol "Hapus"
        ├── Hanya aktif jika tema tidak sedang aktif
        └── CI4 DELETE /internal/theme/{domain}/{theme_name}
```

**Aturan editor**:
- Edit hanya tersedia untuk tema yang **aktif**
- Tema yang tidak aktif hanya bisa: diaktifkan atau dihapus
- Default theme tidak muncul di daftar edit (hanya sebagai source duplikasi)

---

## 8. Visual Design Default Theme

### Palet Warna (CSS Variables)

```css
:root {
    --color-primary:    #1b5e20;  /* hijau tua pemerintahan */
    --color-primary-lt: #2e7d32;  /* hijau medium (hover) */
    --color-accent:     #f9a825;  /* kuning aksen */
    --color-bg:         #f5f5f5;
    --color-text:       #212121;
    --color-muted:      #757575;
    --color-border:     #e0e0e0;
    --color-white:      #ffffff;
}
```

Tenant bisa override warna via `assets/css/style.css` di tema custom mereka.

### Layout

- Grid: CSS Flexbox + Grid (tidak pakai Bootstrap)
- Container max-width: 1200px
- Breakpoint: 768px (tablet), 480px (mobile)
- Kolom dalam: 8/4 (konten + sidebar)

---

## 9. Halaman per File

### `header.html`

```
┌─────────────────────────────────────────────────┐
│ [LOGO] Nama Instansi                   [SEARCH] │
│        Tagline                                  │
├─────────────────────────────────────────────────┤
│  Home | Berita | Halaman | Download | ...       │  ← hijau
├─────────────────────────────────────────────────┤
│  [SLIDER — hanya jika .IsHome = true]           │
└─────────────────────────────────────────────────┘
```

```html
{{define "header"}}
<img src="{{.Tenant.Logo}}">
<h1>{{.Tenant.NamaOrg}}</h1>
<p>{{.Tenant.Tagline}}</p>
{{range .Menu}}<a href="{{.URL}}">{{.Label}}</a>{{end}}
{{if .IsHome}}{{range .Slider}}...{{end}}{{end}}
{{end}}
```

### `footer.html`

```
┌──────────────────────────────────────────────────┐
│ Nama Instansi    │ Menu Cepat  │ Kategori        │
│ Alamat/Kontak    │             │                 │
├──────────────────────────────────────────────────┤
│ © 2026 Nama Instansi · Powered by ObongCMS       │
└──────────────────────────────────────────────────┘
```

### `index.html`

```
┌─────────────────────────────────┬──────────────┐
│  BERITA UTAMA (1 besar)         │              │
│  ┌───┐ ┌───┐ ┌───┐             │   SIDEBAR    │
│  │ 2 │ │ 3 │ │ 4 │ (3 kecil)  │  - Berita    │
├──┴───┴─┴───┴─┴───┴─────────────┤    Terkini   │
│  Grid berita per kategori       │              │
└─────────────────────────────────┴──────────────┘
```

### `list.html`

Breadcrumb → list artikel (thumbnail kiri + judul/excerpt kanan) → pagination → sidebar

```html
{{range .Data.Items}}
<article>
    <img src="{{.Thumbnail}}">
    <div>
        <span>{{.Kategori}}</span>
        <h2><a href="{{.Slug}}">{{.Judul}}</a></h2>
        <p>{{truncate .Ringkasan 150}}</p>
        <time>{{formatDate .TanggalTerbit}}</time>
    </div>
</article>
{{end}}
```

### `single.html`

Breadcrumb → judul → meta (tanggal, penulis, kategori) → thumbnail → konten → share → sidebar

```html
<h1>{{.Data.Judul}}</h1>
<time>{{formatDate .Data.TanggalTerbit}}</time>
<img src="{{.Data.Thumbnail}}">
<div class="konten">{{safeHTML .Data.Isi}}</div>
```

### `download.html`

Breadcrumb → search input → tabel (nama dokumen, tipe, ukuran, tombol unduh)

```html
{{range .Data.Items}}
<tr>
    <td>{{.NamaDokumen}}</td>
    <td>{{.TipeFile}}</td>
    <td>{{.Ukuran}}</td>
    <td><a href="{{.URL}}" download>Unduh</a></td>
</tr>
{{end}}
```

---

## 10. CSS & JS

### `assets/css/style.css`
1. CSS reset + base typography
2. CSS variables (warna, spacing, font)
3. Layout: container, grid, flexbox
4. Component: navbar, slider, card berita, sidebar, footer, badge, pagination, tabel
5. Responsive breakpoints

### `assets/js/app.js` (Vanilla JS)

| Fungsi | Keterangan |
|--------|------------|
| Menu mobile toggle | Hamburger → collapse navbar |
| Slider auto-play | CSS transition + JS interval |
| Search | Submit ke Google site search |
| Share button | window.open URL dinamis |
| Active menu | Highlight menu item sesuai URL |

jQuery tidak di-bundle — jika tenant butuh, upload sendiri ke folder custom theme.

---

## 11. Yang Tidak Dicakup Spec Ini

- UI themes editor di panel Redaksi (spec terpisah)
- Implementasi code editor (Monaco/CodeMirror) di Redaksi
- Preview tema sebelum aktivasi
- Versioning / backup file tema sebelum diedit

---

## 12. Checklist Implementasi

### Go Edge
- [ ] Embed default theme: `//go:embed shared/themes/default`
- [ ] Logic `themeLoader`: cek active_theme → load custom atau embedded
- [ ] Template cache per domain + invalidasi saat activate
- [ ] Tambah `PageData` struct + semua JSON reader
- [ ] Daftarkan FuncMap: `safeHTML`, `formatDate`, `truncate`, `assetURL`
- [ ] Internal API: `list`, `files`, `file GET/PUT`, `duplicate`, `activate`, `delete`, `upload`

### Default Theme Files
- [ ] `header.html`
- [ ] `footer.html`
- [ ] `index.html`
- [ ] `list.html`
- [ ] `single.html`
- [ ] `download.html`
- [ ] `assets/css/style.css`
- [ ] `assets/js/app.js`

### CI4 Redaksi
- [ ] Themes controller: list, edit, duplikat, aktivasi, hapus, upload
- [ ] Code editor view (Monaco atau textarea fallback)
- [ ] Validasi: tidak bisa edit tema tidak aktif, tidak bisa hapus tema aktif, max 4 tema
