# Design Spec: Modul Tampilan — ObongCMS

**Tanggal**: 2026-05-08
**Status**: Approved
**Scope**: Modul Tampilan di Redaksi CI4 — pengaturan visual tenant + widget layout system

---

## 1. Gambaran Umum

Modul Tampilan terdiri dari dua sub-modul:

1. **Pengaturan** — form isian visual tenant: logo, nama org, warna, kontak, sosmed
2. **Widget Layout** — drag-and-drop blok widget ke posisi yang tersedia di tema

Keduanya menghasilkan satu `setting.json` per tenant yang di-push ke Go Edge. Go Edge membaca `setting.json` untuk render tampilan situs publik secara SSR.

---

## 2. Database

### `cms_tampilan` (baru)

```sql
CREATE TABLE cms_tampilan (
    tenant_id   INT          NOT NULL,
    settings    JSON         NOT NULL DEFAULT '{}',
    updated_at  DATETIME     NULL,
    updated_by  VARCHAR(100) NULL,
    PRIMARY KEY (tenant_id),
    CONSTRAINT fk_tampilan_tenant FOREIGN KEY (tenant_id) REFERENCES app_tenants(id)
);
```

Field `settings` menyimpan semua pengaturan visual sebagai JSON:

```json
{
  "nama_org":     "Pemerintah Aceh",
  "tagline":      "Maju Bersama",
  "logo":         "/media/berita/2026/05/logo.png",
  "favicon":      "/media/berita/2026/05/favicon.ico",
  "warna_primer": "#006B3C",
  "kontak": {
    "alamat": "Jl. T. Nyak Arief No.219",
    "telp":   "(0651) 123456",
    "email":  "info@acehprov.go.id"
  },
  "sosmed": {
    "facebook":  "",
    "instagram": "",
    "youtube":   "",
    "twitter":   ""
  },
  "footer_copyright": "© 2026 Pemerintah Aceh",
  "tracking": {
    "google_tag_manager": "",
    "google_analytics":   "",
    "facebook_pixel":     "",
    "google_site_verify": "",
    "custom_head":        ""
  }
}
```

### `cms_widget_layout` (sudah ada)

```
tenant_id    INT
layout_name  VARCHAR(100)
widgets      TEXT/JSON    -- array widget dengan option
PRIMARY KEY  (tenant_id, layout_name)
```

---

## 3. Widget Definitions

Widget types **hardcoded di Go Edge** — tidak disimpan di DB, tidak bisa ditambah dari UI.

| widget_name | Label | Data Source Go Edge | Options |
|-------------|-------|---------------------|---------|
| `berita_terkini` | Berita Terkini | `berita.json` | judul (string), kategori (string), limit (int), tampil_thumbnail (bool), tampil_deskripsi (bool) |
| `agenda_terkini` | Agenda Terkini | `agenda.json` | judul (string), limit (int) |
| `daftar_pejabat` | Daftar Pejabat | `pejabat.json` | judul (string), nama_jabatan (string) |
| `daftar_halaman` | Daftar Halaman | `halaman.json` | judul (string) |
| `daftar_kategori` | Daftar Kategori | extract dari `berita.json` | judul (string) |
| `custom_menu` | Custom Menu | `menu.json` | judul (string), menu (string — nama menu) |
| `custom_html` | Custom HTML | — | judul (string), html (string — HTML bebas, no JS) |
| `peta_lokasi` | Peta dan Lokasi | — | judul (string), koordinat (string — lat,lng), lokasi (string) |
| `video_youtube` | Video YouTube | — | judul (string), video_id (string) |

CI4 perlu tahu daftar widget di atas untuk ditampilkan di builder UI. Cara paling sederhana: **hardcoded juga di CI4** sebagai array PHP konstanta — tidak perlu fetch dari Go Edge.

---

## 4. Widget Positions

Posisi **ditentukan oleh tema default** — fix, tidak bisa diubah tenant. Tema default menyediakan slot:

| layout_name | Letak di tema |
|-------------|---------------|
| `sidebar` | Sidebar di semua halaman kecuali homepage |
| `sidebar_home` | Sidebar di homepage |
| `footer_1` | Kolom footer ke-1 |
| `footer_2` | Kolom footer ke-2 |
| `footer_3` | Kolom footer ke-3 |
| `footer_4` | Kolom footer ke-4 |

Tema custom (duplikat) bisa menambah/mengurangi posisi di templatenya, tapi widget_layout tetap mengikuti nama posisi yang sama.

---

## 5. Alur Backend CI4

### Route

```
GET  /redaksi/tampilan/pengaturan        → form pengaturan visual
POST /redaksi/tampilan/pengaturan        → simpan + push setting.json

GET  /redaksi/tampilan/widget            → widget layout builder
POST /redaksi/tampilan/widget/simpan     → simpan widget layout + push setting.json
```

### Controller: `Tampilan.php`

```
pengaturan()
    ├── Permission: redaksi.tampilan.read
    ├── Baca cms_tampilan WHERE tenant_id = ?
    └── Render view form

simpanPengaturan()
    ├── Permission: redaksi.tampilan.upsert
    ├── Validasi via ValTampilan
    ├── Handle upload logo/favicon → forward ke Go Edge media
    ├── Upsert cms_tampilan (tenant_id, settings JSON)
    └── generateDanPush() → return redirect

widget()
    ├── Permission: redaksi.tampilan.read
    ├── Baca semua cms_widget_layout WHERE tenant_id = ?
    ├── Siapkan WIDGET_DEFINITIONS (hardcoded konstanta)
    └── Render view widget builder

simpanWidget()
    ├── Permission: redaksi.tampilan.upsert
    ├── Terima JSON: { "sidebar": [...], "footer_1": [...], ... }
    ├── Validasi: widget_name harus ada di WIDGET_DEFINITIONS
    ├── Delete + insert ulang cms_widget_layout untuk tenant ini
    └── generateDanPush() → return jsonSuccess
```

### generateDanPush() — Private Method

```
1. SELECT settings FROM cms_tampilan WHERE tenant_id = ?
2. SELECT layout_name, widgets FROM cms_widget_layout WHERE tenant_id = ?
3. Merge → build array setting_json
4. GoEdge::publishContent(domain, [
       ['path' => 'setting.json', 'content' => json_encode(setting_json)]
   ])
```

---

## 6. Struktur setting.json (Go Edge)

```json
{
  "nama_org":          "Pemerintah Aceh",
  "tagline":           "Maju Bersama",
  "logo":              "/media/berita/2026/05/logo.png",
  "favicon":           "/media/berita/2026/05/favicon.ico",
  "warna_primer":      "#006B3C",
  "kontak": {
    "alamat": "Jl. T. Nyak Arief No.219",
    "telp":   "(0651) 123456",
    "email":  "info@acehprov.go.id"
  },
  "sosmed": {
    "facebook":  "",
    "instagram": "",
    "youtube":   "",
    "twitter":   ""
  },
  "footer_copyright":  "© 2026 Pemerintah Aceh",
  "google_analytics":  "",
  "widget_layouts": [
    {
      "layout_name": "sidebar",
      "widgets": [
        {
          "widget_name": "berita_terkini",
          "widget_option": { "judul": "Berita Terkini", "limit": 5, "tampil_thumbnail": true }
        }
      ]
    },
    {
      "layout_name": "footer_1",
      "widgets": [
        {
          "widget_name": "custom_html",
          "widget_option": { "judul": "Alamat", "html": "<p>Jl. T. Nyak Arief...</p>" }
        }
      ]
    }
  ]
}
```

---

## 7. Go Edge — SSR Widget Rendering

### Struct

```go
type TenantSetting struct {
    NamaOrg         string        `json:"nama_org"`
    Tagline         string        `json:"tagline"`
    Logo            string        `json:"logo"`
    Favicon         string        `json:"favicon"`
    WarnaPrimer     string        `json:"warna_primer"`
    Kontak          KontakInfo    `json:"kontak"`
    Sosmed          SosmedLinks   `json:"sosmed"`
    FooterCopyright string        `json:"footer_copyright"`
    GoogleAnalytics string        `json:"google_analytics"`
    WidgetLayouts   []WidgetLayout `json:"widget_layouts"`
}

type WidgetLayout struct {
    LayoutName string   `json:"layout_name"`
    Widgets    []Widget `json:"widgets"`
}

type Widget struct {
    WidgetName   string                 `json:"widget_name"`
    WidgetOption map[string]interface{} `json:"widget_option"`
}

type RenderedWidget struct {
    Name  string
    HTML  template.HTML
}
```

### Rendering Flow

```
Request masuk → domain
    │
    ├── Baca setting.json → TenantSetting
    ├── Untuk tiap layout_name yang dibutuhkan halaman ini:
    │   └── renderWidgets(layoutName, widgets, tenantData) → []RenderedWidget
    │       ├── berita_terkini → baca berita.json → filter kategori → limit N → render HTML
    │       ├── agenda_terkini → baca agenda.json → limit N → render HTML
    │       ├── daftar_pejabat → baca pejabat.json → filter jabatan → render HTML
    │       ├── daftar_halaman → baca halaman.json → render HTML
    │       ├── daftar_kategori → extract dari berita.json → unique kategori → render HTML
    │       ├── custom_menu    → baca menu.json → find by name → render HTML
    │       ├── custom_html    → return option["html"] langsung (sanitized)
    │       ├── peta_lokasi    → generate iframe Google Maps embed
    │       └── video_youtube  → generate iframe YouTube embed
    │
    ├── Inject ke PageData:
    │   Widgets map[string][]RenderedWidget
    │   Setting TenantSetting
    │
    └── Template:
        {{range index .Widgets "sidebar"}}{{.HTML}}{{end}}
```

### PageData Update

```go
type PageData struct {
    // ... field yang sudah ada ...
    Setting TenantSetting
    Widgets map[string][]RenderedWidget
}
```

---

## 8. Validasi & Aturan

- `widget_name` wajib ada di daftar WIDGET_DEFINITIONS — widget tidak dikenal di-skip, tidak error
- `custom_html` — HTML di-sanitize saat simpan (strip script, event handler) via `sanitizeHtml()`
- Logo/favicon wajib diupload via Go Edge media handler — tidak boleh URL eksternal langsung
- Tenant hanya bisa edit Tampilan miliknya sendiri — semua query filter `tenant_id`
- Posisi yang tidak ada widgetnya tidak perlu disimpan di DB (skip baris kosong)

---

## 9. Checklist Implementasi

### CI4 — Redaksi

- [ ] Buat tabel `cms_tampilan` (SQL migration)
- [ ] Buat `ValTampilan.php` update — validasi settings fields
- [ ] Buat `Tampilan.php` controller — `pengaturan()`, `simpanPengaturan()`, `widget()`, `simpanWidget()`
- [ ] Definisi konstanta `WIDGET_DEFINITIONS` (hardcoded PHP array)
- [ ] View: form pengaturan (`pengaturan.html`)
- [ ] View: widget layout builder (`widget.html`)
- [ ] Private method `generateDanPush()` — merge + push setting.json
- [ ] Route: `Config/Routes.php`

### Go Edge

- [ ] Struct `TenantSetting` + `WidgetLayout` + `Widget` + `RenderedWidget`
- [ ] Reader `setting.json` per domain
- [ ] `renderWidgets()` — dispatch per `widget_name`
- [ ] Implementasi render tiap widget type (9 widget)
- [ ] Update `PageData` — tambah field `Setting` dan `Widgets`
- [ ] Update semua handler site untuk inject widgets ke PageData
