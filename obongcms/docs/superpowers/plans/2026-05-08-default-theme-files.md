# Default Theme Files — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buat 6 file HTML template + CSS + JS untuk default theme pemerintahan ObongCMS yang disimpan di `frontend/shared/themes/default/`.

**Architecture:** Semua file Go template (`{{define "content"}}`, `{{define "header"}}`, `{{define "footer"}}`). CSS custom tanpa framework eksternal, pakai CSS variables untuk warna. JS vanilla untuk interaksi (menu, slider, search). Mirip struktur acehcms lama tapi Go template syntax.

**Tech Stack:** Go `html/template`, CSS3 (variables, flexbox, grid), Vanilla JS (ES6)

**Dependency:** Plan 1 (Go Edge Theme System) harus selesai dulu — file-file ini adalah isi dari embedded FS.

**Referensi Spec:** `docs/superpowers/specs/2026-05-08-default-theme-design.md`

---

## File Map

| Status | Path | Peran |
|--------|------|-------|
| Create | `frontend/shared/themes/default/header.html` | `{{define "header"}}` — logo, menu, slider |
| Create | `frontend/shared/themes/default/footer.html` | `{{define "footer"}}` — info instansi, link |
| Create | `frontend/shared/themes/default/base.html` | Shell HTML lengkap, include header+footer+content |
| Create | `frontend/shared/themes/default/index.html` | `{{define "content"}}` — home |
| Create | `frontend/shared/themes/default/list.html` | `{{define "content"}}` — daftar berita |
| Create | `frontend/shared/themes/default/single.html` | `{{define "content"}}` — detail berita/halaman |
| Create | `frontend/shared/themes/default/download.html` | `{{define "content"}}` — daftar dokumen |
| Create | `frontend/shared/themes/default/assets/css/style.css` | CSS custom, no framework |
| Create | `frontend/shared/themes/default/assets/js/app.js` | Vanilla JS |

---

## Task 1: `base.html` — Shell HTML

**Files:**
- Create: `frontend/shared/themes/default/base.html`

- [ ] Buat `base.html`:

```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <meta name="robots" content="index, follow">
    <meta name="description" content="{{.Meta.Description}}">
    <meta name="author" content="{{.Tenant.NamaOrg}}">

    <!-- OpenGraph -->
    <meta property="og:title" content="{{.Meta.Title}}">
    <meta property="og:description" content="{{.Meta.Description}}">
    <meta property="og:image" content="{{.Meta.Image}}">
    <meta property="og:url" content="{{.Meta.URL}}">
    <meta property="og:type" content="{{.Meta.Type}}">
    <meta property="og:locale" content="id_ID">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{.Meta.Title}}">
    <meta name="twitter:description" content="{{.Meta.Description}}">
    <meta name="twitter:image" content="{{.Meta.Image}}">

    <link rel="shortcut icon" href="{{.Tenant.Icon}}" id="favicon">
    <title>{{.Meta.Title}}</title>

    <link rel="stylesheet" href="/assets/themes/default/css/style.css">
</head>
<body>
    {{template "header" .}}
    <main id="main-content">
        {{template "content" .}}
    </main>
    {{template "footer" .}}
    <script src="/assets/themes/default/js/app.js"></script>
</body>
</html>
```

- [ ] Build test — pastikan Go Edge bisa parse template ini bersama file lain:

```bash
cd frontend && go build ./... && go test ./internal/thememanager/... -v
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/base.html
git commit -m "feat(theme): add base.html shell"
```

---

## Task 2: `header.html` + `footer.html`

**Files:**
- Create: `frontend/shared/themes/default/header.html`
- Create: `frontend/shared/themes/default/footer.html`

- [ ] Buat `header.html`:

```html
{{define "header"}}
<header class="site-header">

    <!-- Preloader -->
    <div class="preloader" id="preloader">
        <div class="preloader-spinner"></div>
    </div>

    <!-- Top bar: logo + search -->
    <div class="header-top">
        <div class="container">
            <div class="header-brand">
                {{if .Tenant.Logo}}
                <a href="/"><img src="{{.Tenant.Logo}}" alt="{{.Tenant.NamaOrg}}" class="header-logo"></a>
                {{end}}
                <div class="header-title">
                    <h1 class="header-nama-org"><a href="/">{{.Tenant.NamaOrg}}</a></h1>
                    {{if .Tenant.Tagline}}<p class="header-tagline">{{.Tenant.Tagline}}</p>{{end}}
                </div>
            </div>
            <div class="header-search">
                <div class="search-box">
                    <input type="text" id="search-input" placeholder="Cari berita...">
                    <button type="button" id="search-btn" onclick="doSearch()">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Navigation menu -->
    <nav class="site-nav" role="navigation" aria-label="Menu utama">
        <div class="container">
            <button class="nav-toggle" id="nav-toggle" aria-label="Buka menu" aria-expanded="false">
                <span></span><span></span><span></span>
            </button>
            <ul class="nav-menu" id="nav-menu">
                <li class="nav-item"><a href="/" class="nav-link">Beranda</a></li>
                <li class="nav-item"><a href="/berita" class="nav-link">Berita</a></li>
                {{range .Menu}}
                <li class="nav-item{{if .Children}} has-dropdown{{end}}">
                    <a href="{{.URL}}" class="nav-link">{{.Label}}</a>
                    {{if .Children}}
                    <ul class="nav-dropdown">
                        {{range .Children}}
                        <li><a href="{{.URL}}">{{.Label}}</a></li>
                        {{end}}
                    </ul>
                    {{end}}
                </li>
                {{end}}
                <li class="nav-item"><a href="/download" class="nav-link">Download</a></li>
            </ul>
        </div>
    </nav>

    <!-- Slider — hanya di halaman home -->
    {{if .IsHome}}
    <div class="slider-wrapper" id="slider">
        <div class="slider-track" id="slider-track">
            {{range .Slider}}
            <div class="slide">
                {{if .Link}}<a href="{{.Link}}">{{end}}
                <img src="{{.Gambar}}" alt="{{.Judul}}" class="slide-img">
                {{if .Judul}}<div class="slide-caption">{{.Judul}}</div>{{end}}
                {{if .Link}}</a>{{end}}
            </div>
            {{end}}
        </div>
        <button class="slider-btn slider-prev" id="slider-prev" aria-label="Sebelumnya">&#10094;</button>
        <button class="slider-btn slider-next" id="slider-next" aria-label="Berikutnya">&#10095;</button>
        <div class="slider-dots" id="slider-dots"></div>
    </div>
    {{end}}

</header>
{{end}}
```

- [ ] Buat `footer.html`:

```html
{{define "footer"}}
<footer class="site-footer">
    <div class="footer-body">
        <div class="container">
            <div class="footer-grid">

                <!-- Kolom 1: Info instansi -->
                <div class="footer-col">
                    {{if .Tenant.Logo}}
                    <img src="{{.Tenant.Logo}}" alt="{{.Tenant.NamaOrg}}" class="footer-logo">
                    {{end}}
                    <h3 class="footer-nama-org">{{.Tenant.NamaOrg}}</h3>
                    {{if .Tenant.Tagline}}<p class="footer-tagline">{{.Tenant.Tagline}}</p>{{end}}
                    <!-- Sosial media -->
                    <div class="footer-sosmed">
                        {{if .Tenant.Sosmed.Facebook}}
                        <a href="{{.Tenant.Sosmed.Facebook}}" target="_blank" rel="noopener" class="sosmed-link" title="Facebook">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                        </a>
                        {{end}}
                        {{if .Tenant.Sosmed.Twitter}}
                        <a href="{{.Tenant.Sosmed.Twitter}}" target="_blank" rel="noopener" class="sosmed-link" title="Twitter/X">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                        </a>
                        {{end}}
                        {{if .Tenant.Sosmed.Instagram}}
                        <a href="{{.Tenant.Sosmed.Instagram}}" target="_blank" rel="noopener" class="sosmed-link" title="Instagram">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                        </a>
                        {{end}}
                        {{if .Tenant.Sosmed.Youtube}}
                        <a href="{{.Tenant.Sosmed.Youtube}}" target="_blank" rel="noopener" class="sosmed-link" title="Youtube">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
                        </a>
                        {{end}}
                    </div>
                </div>

                <!-- Kolom 2: Menu cepat -->
                <div class="footer-col">
                    <h4 class="footer-heading">Menu Cepat</h4>
                    <ul class="footer-links">
                        <li><a href="/">Beranda</a></li>
                        <li><a href="/berita">Berita</a></li>
                        <li><a href="/download">Download</a></li>
                        {{range .Menu}}
                        <li><a href="{{.URL}}">{{.Label}}</a></li>
                        {{end}}
                    </ul>
                </div>

                <!-- Kolom 3: Sidebar berita terbaru -->
                <div class="footer-col">
                    <h4 class="footer-heading">Berita Terbaru</h4>
                    <ul class="footer-berita">
                        {{range .Sidebar}}
                        <li>
                            <a href="/berita/{{.Slug}}">{{.Judul}}</a>
                            <small>{{formatDate .TanggalTerbit}}</small>
                        </li>
                        {{end}}
                    </ul>
                </div>

            </div>
        </div>
    </div>
    <div class="footer-bottom">
        <div class="container">
            <p>&copy; {{.Tenant.NamaOrg}} &mdash; Powered by <a href="https://obongcms.id">ObongCMS</a></p>
        </div>
    </div>
</footer>
{{end}}
```

- [ ] Build check:

```bash
cd frontend && go build ./...
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/header.html frontend/shared/themes/default/footer.html
git commit -m "feat(theme): add header and footer partials"
```

---

## Task 3: `index.html` — Halaman Home

**Files:**
- Create: `frontend/shared/themes/default/index.html`

- [ ] Buat `index.html`:

```html
{{define "content"}}
<div class="home-wrapper">
    <div class="container">

        {{with .Data}}
        {{$home := .}}

        <!-- Berita utama + 3 terbaru -->
        {{if $home.BeritaUtama}}
        <section class="home-headline">
            <div class="headline-main">
                <a href="/berita/{{$home.BeritaUtama.Slug}}" class="headline-link">
                    {{if $home.BeritaUtama.Thumbnail}}
                    <img src="{{$home.BeritaUtama.Thumbnail}}" alt="{{$home.BeritaUtama.Judul}}" class="headline-img">
                    {{end}}
                    <div class="headline-body">
                        {{if $home.BeritaUtama.Kategori}}<span class="badge">{{$home.BeritaUtama.Kategori}}</span>{{end}}
                        <h2 class="headline-judul">{{$home.BeritaUtama.Judul}}</h2>
                        <time class="headline-tanggal">{{formatDate $home.BeritaUtama.TanggalTerbit}}</time>
                    </div>
                </a>
            </div>
            {{if $home.BeritaTerbaru}}
            <div class="headline-side">
                {{range $home.BeritaTerbaru}}
                <a href="/berita/{{.Slug}}" class="headline-side-item">
                    {{if .Thumbnail}}
                    <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="headline-side-img">
                    {{end}}
                    <div class="headline-side-body">
                        {{if .Kategori}}<span class="badge badge-sm">{{.Kategori}}</span>{{end}}
                        <h3 class="headline-side-judul">{{.Judul}}</h3>
                        <time>{{formatDate .TanggalTerbit}}</time>
                    </div>
                </a>
                {{end}}
            </div>
            {{end}}
        </section>
        {{end}}

        <!-- Berita per kategori + sidebar -->
        <div class="home-body">
            <div class="home-main">
                {{range $home.BeritaPerKategori}}
                <section class="kategori-section">
                    <div class="section-header">
                        <h2 class="section-title">{{.Nama}}</h2>
                        <a href="/berita/kategori/{{.Slug}}" class="section-more">Lihat Semua &rsaquo;</a>
                    </div>
                    <div class="berita-grid">
                        {{range .Items}}
                        <article class="berita-card">
                            <a href="/berita/{{.Slug}}" class="berita-card-img-link">
                                {{if .Thumbnail}}
                                <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="berita-card-img">
                                {{else}}
                                <div class="berita-card-no-img"></div>
                                {{end}}
                            </a>
                            <div class="berita-card-body">
                                <h3 class="berita-card-judul">
                                    <a href="/berita/{{.Slug}}">{{.Judul}}</a>
                                </h3>
                                {{if .Ringkasan}}<p class="berita-card-excerpt">{{truncate .Ringkasan 100}}</p>{{end}}
                                <time class="berita-card-tanggal">{{formatDate .TanggalTerbit}}</time>
                            </div>
                        </article>
                        {{end}}
                    </div>
                </section>
                {{end}}
            </div>

            <!-- Sidebar -->
            <aside class="home-sidebar">
                <div class="sidebar-widget">
                    <h3 class="sidebar-title">Berita Terkini</h3>
                    <ul class="sidebar-berita">
                        {{range $.Sidebar}}
                        <li class="sidebar-berita-item">
                            {{if .Thumbnail}}
                            <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="sidebar-berita-img">
                            {{end}}
                            <div class="sidebar-berita-body">
                                <a href="/berita/{{.Slug}}" class="sidebar-berita-judul">{{.Judul}}</a>
                                <time>{{formatDate .TanggalTerbit}}</time>
                            </div>
                        </li>
                        {{end}}
                    </ul>
                </div>
            </aside>
        </div>

        {{end}}
    </div>
</div>
{{end}}
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/index.html
git commit -m "feat(theme): add index.html home page"
```

---

## Task 4: `list.html` — Daftar Berita

**Files:**
- Create: `frontend/shared/themes/default/list.html`

- [ ] Buat `list.html`:

```html
{{define "content"}}
<div class="container page-wrapper">

    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
            <li><a href="/">Beranda</a></li>
            <li aria-current="page">Berita</li>
        </ol>
    </nav>

    <div class="page-body">
        <div class="page-main">
            <div class="card page-card">
                <div class="card-header">
                    <h1 class="page-title">Daftar Berita</h1>
                </div>
            </div>

            {{with .Data}}
            <div class="berita-list">
                {{range .Items}}
                <article class="berita-list-item">
                    <a href="/berita/{{.Slug}}" class="berita-list-img-link">
                        {{if .Thumbnail}}
                        <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="berita-list-img">
                        {{else}}
                        <div class="berita-list-no-img"></div>
                        {{end}}
                    </a>
                    <div class="berita-list-body">
                        {{if .Kategori}}<span class="badge">{{.Kategori}}</span>{{end}}
                        <h2 class="berita-list-judul">
                            <a href="/berita/{{.Slug}}">{{.Judul}}</a>
                        </h2>
                        {{if .Ringkasan}}<p class="berita-list-excerpt">{{truncate .Ringkasan 150}}</p>{{end}}
                        <div class="berita-list-meta">
                            <time>{{formatDate .TanggalTerbit}}</time>
                        </div>
                        <a href="/berita/{{.Slug}}" class="btn-more">Lihat Selengkapnya &rsaquo;</a>
                    </div>
                </article>
                {{end}}
            </div>

            <!-- Pagination -->
            {{if gt .TotalPage 1}}
            <nav class="pagination" aria-label="Halaman">
                {{if .PrevURL}}<a href="{{.PrevURL}}" class="page-btn">&laquo; Sebelumnya</a>{{end}}
                <span class="page-info">Halaman {{.Page}} dari {{.TotalPage}}</span>
                {{if .NextURL}}<a href="{{.NextURL}}" class="page-btn">Berikutnya &raquo;</a>{{end}}
            </nav>
            {{end}}

            {{else}}
            <div class="empty-state">
                <p>Belum ada berita yang dipublikasikan.</p>
            </div>
            {{end}}
        </div>

        <!-- Sidebar -->
        <aside class="page-sidebar">
            <div class="sidebar-widget">
                <h3 class="sidebar-title">Berita Terkini</h3>
                <ul class="sidebar-berita">
                    {{range .Sidebar}}
                    <li class="sidebar-berita-item">
                        {{if .Thumbnail}}
                        <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="sidebar-berita-img">
                        {{end}}
                        <div class="sidebar-berita-body">
                            <a href="/berita/{{.Slug}}" class="sidebar-berita-judul">{{.Judul}}</a>
                            <time>{{formatDate .TanggalTerbit}}</time>
                        </div>
                    </li>
                    {{end}}
                </ul>
            </div>
        </aside>
    </div>
</div>
{{end}}
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/list.html
git commit -m "feat(theme): add list.html berita list page"
```

---

## Task 5: `single.html` — Detail Berita / Halaman

**Files:**
- Create: `frontend/shared/themes/default/single.html`

- [ ] Buat `single.html`:

```html
{{define "content"}}
<div class="container page-wrapper">

    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
            <li><a href="/">Beranda</a></li>
            <li><a href="/berita">Berita</a></li>
            <li aria-current="page">{{with .Data}}{{.Judul}}{{end}}</li>
        </ol>
    </nav>

    <div class="page-body">
        <div class="page-main">
            {{with .Data}}
            <article class="artikel-detail">
                <div class="card">
                    <div class="card-header">
                        {{if .Kategori}}
                        <a href="/berita/kategori/{{.KategoriSlug}}" class="badge badge-kategori">{{.Kategori}}</a>
                        {{end}}
                        <h1 class="artikel-judul">{{.Judul}}</h1>
                        <div class="artikel-meta">
                            {{if .Penulis}}<span class="meta-item">Oleh: <strong>{{.Penulis}}</strong></span>{{end}}
                            {{if .TanggalTerbit}}<time class="meta-item">{{formatDate .TanggalTerbit}}</time>{{end}}
                        </div>
                        <!-- Share buttons -->
                        <div class="share-buttons" id="share-buttons">
                            <span class="share-label">Bagikan:</span>
                            <a href="#" class="share-btn share-fb" onclick="shareFacebook(event)" title="Share ke Facebook">Facebook</a>
                            <a href="#" class="share-btn share-tw" onclick="shareTwitter(event)" title="Share ke Twitter">Twitter</a>
                            <a href="#" class="share-btn share-wa" onclick="shareWhatsapp(event)" title="Share ke WhatsApp">WhatsApp</a>
                        </div>
                    </div>

                    <!-- Thumbnail -->
                    {{if .Thumbnail}}
                    <div class="artikel-thumbnail">
                        <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="artikel-img">
                    </div>
                    {{end}}

                    <!-- Konten -->
                    <div class="card-body artikel-konten">
                        {{safeHTML .Isi}}
                    </div>

                    <!-- Tags -->
                    {{if .Tags}}
                    <div class="artikel-tags">
                        <span class="tags-label">Tag:</span>
                        {{range .Tags}}
                        <span class="tag">{{.}}</span>
                        {{end}}
                    </div>
                    {{end}}
                </div>

                <div class="artikel-back">
                    <a href="/berita" class="btn-back">&larr; Kembali ke Daftar Berita</a>
                </div>
            </article>
            {{end}}
        </div>

        <!-- Sidebar -->
        <aside class="page-sidebar">
            <div class="sidebar-widget">
                <h3 class="sidebar-title">Berita Terkini</h3>
                <ul class="sidebar-berita">
                    {{range .Sidebar}}
                    <li class="sidebar-berita-item">
                        {{if .Thumbnail}}
                        <img src="{{.Thumbnail}}" alt="{{.Judul}}" class="sidebar-berita-img">
                        {{end}}
                        <div class="sidebar-berita-body">
                            <a href="/berita/{{.Slug}}" class="sidebar-berita-judul">{{.Judul}}</a>
                            <time>{{formatDate .TanggalTerbit}}</time>
                        </div>
                    </li>
                    {{end}}
                </ul>
            </div>
        </aside>
    </div>
</div>

<script>
function shareFacebook(e) {
    e.preventDefault();
    window.open('https://www.facebook.com/share.php?u=' + encodeURIComponent(window.location.href), '_blank');
}
function shareTwitter(e) {
    e.preventDefault();
    var title = document.querySelector('.artikel-judul') ? document.querySelector('.artikel-judul').textContent : '';
    window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(window.location.href) + '&text=' + encodeURIComponent(title), '_blank');
}
function shareWhatsapp(e) {
    e.preventDefault();
    var title = document.querySelector('.artikel-judul') ? document.querySelector('.artikel-judul').textContent : '';
    window.open('whatsapp://send?text=' + encodeURIComponent(title + ' ' + window.location.href));
}
</script>
{{end}}
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/single.html
git commit -m "feat(theme): add single.html article detail page"
```

---

## Task 6: `download.html` — Daftar Dokumen

**Files:**
- Create: `frontend/shared/themes/default/download.html`

- [ ] Buat `download.html`:

```html
{{define "content"}}
<div class="container page-wrapper">

    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
            <li><a href="/">Beranda</a></li>
            <li aria-current="page">Download</li>
        </ol>
    </nav>

    <div class="page-body">
        <div class="page-main" style="width:100%">
            <div class="card">
                <div class="card-header">
                    <h1 class="page-title">{{with .Data}}{{.Judul}}{{else}}Daftar Dokumen{{end}}</h1>
                </div>
                <div class="card-body">
                    <!-- Search filter -->
                    <div class="download-search">
                        <input type="text" id="download-filter" placeholder="Cari dokumen..." class="input-search" oninput="filterDownload(this.value)">
                    </div>

                    {{with .Data}}
                    {{if .Items}}
                    <div class="table-responsive">
                        <table class="download-table" id="download-table">
                            <thead>
                                <tr>
                                    <th>Nama Dokumen</th>
                                    <th>Tipe</th>
                                    <th>Ukuran</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="download-tbody">
                                {{range .Items}}
                                <tr>
                                    <td>{{.NamaDokumen}}</td>
                                    <td><span class="file-badge file-{{.TipeFile}}">{{.TipeFile}}</span></td>
                                    <td>{{.Ukuran}}</td>
                                    <td>
                                        <a href="{{.URL}}" class="btn-download" download target="_blank">
                                            Unduh
                                        </a>
                                    </td>
                                </tr>
                                {{end}}
                            </tbody>
                        </table>
                    </div>
                    {{else}}
                    <div class="empty-state">
                        <p>Belum ada dokumen yang tersedia.</p>
                    </div>
                    {{end}}
                    {{end}}
                </div>
            </div>
        </div>
    </div>
</div>

<script>
function filterDownload(query) {
    var rows = document.querySelectorAll('#download-tbody tr');
    var q = query.toLowerCase();
    rows.forEach(function(row) {
        var text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}
</script>
{{end}}
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/download.html
git commit -m "feat(theme): add download.html document list page"
```

---

## Task 7: `assets/css/style.css` — Custom CSS

**Files:**
- Create: `frontend/shared/themes/default/assets/css/style.css`

- [ ] Buat `style.css` dengan struktur berikut (tulis lengkap per section):

**Section 1 — CSS Variables + Reset:**
```css
/* =============================================
   CSS Variables
   ============================================= */
:root {
    --color-primary:     #1b5e20;
    --color-primary-lt:  #2e7d32;
    --color-primary-dk:  #145214;
    --color-accent:      #f9a825;
    --color-bg:          #f5f5f5;
    --color-bg-white:    #ffffff;
    --color-text:        #212121;
    --color-text-muted:  #757575;
    --color-border:      #e0e0e0;
    --color-danger:      #c62828;

    --font-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-size-base: 16px;
    --line-height-base: 1.6;

    --container-max:  1200px;
    --container-pad:  0 16px;
    --radius-sm:      4px;
    --radius-md:      8px;
    --shadow-sm:      0 1px 3px rgba(0,0,0,.12);
    --shadow-md:      0 2px 8px rgba(0,0,0,.15);
    --transition:     0.2s ease;
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: var(--font-size-base); scroll-behavior: smooth; }
body { font-family: var(--font-base); color: var(--color-text); background: var(--color-bg); line-height: var(--line-height-base); }
img { max-width: 100%; height: auto; display: block; }
a { color: var(--color-primary); text-decoration: none; }
a:hover { color: var(--color-primary-lt); text-decoration: underline; }
ul { list-style: none; }
```

**Section 2 — Layout:**
```css
.container { max-width: var(--container-max); margin: 0 auto; padding: var(--container-pad); }
.page-wrapper { padding: 16px 0 40px; }
.page-body { display: flex; gap: 24px; align-items: flex-start; }
.page-main { flex: 1; min-width: 0; }
.page-sidebar { width: 300px; flex-shrink: 0; }
@media (max-width: 768px) { .page-body { flex-direction: column; } .page-sidebar { width: 100%; } }
```

**Section 3 — Header:**
```css
.site-header { background: var(--color-bg-white); }
.header-top { padding: 12px 0; border-bottom: 1px solid var(--color-border); }
.header-top .container { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.header-brand { display: flex; align-items: center; gap: 12px; }
.header-logo { height: 60px; width: auto; object-fit: contain; }
.header-nama-org { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); }
.header-nama-org a { color: inherit; }
.header-tagline { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px; }
.search-box { display: flex; border: 1px solid var(--color-border); border-radius: 20px; overflow: hidden; }
.search-box input { border: none; padding: 8px 14px; font-size: 0.875rem; outline: none; width: 200px; }
.search-box button { background: var(--color-primary); border: none; padding: 8px 12px; cursor: pointer; color: white; }
.search-box button:hover { background: var(--color-primary-lt); }
```

**Section 4 — Navigation:**
```css
.site-nav { background: var(--color-primary); }
.site-nav .container { display: flex; align-items: center; position: relative; }
.nav-menu { display: flex; flex-wrap: wrap; }
.nav-item { position: relative; }
.nav-link { display: block; padding: 14px 16px; color: white; font-size: 0.875rem; font-weight: 500; transition: background var(--transition); }
.nav-link:hover { background: var(--color-primary-lt); color: white; text-decoration: none; }
.nav-toggle { display: none; background: none; border: none; cursor: pointer; padding: 14px; }
.nav-toggle span { display: block; width: 22px; height: 2px; background: white; margin: 4px 0; transition: var(--transition); }
.nav-dropdown { display: none; position: absolute; top: 100%; left: 0; background: white; box-shadow: var(--shadow-md); min-width: 180px; z-index: 100; border-radius: 0 0 var(--radius-sm) var(--radius-sm); }
.nav-dropdown li a { display: block; padding: 10px 16px; color: var(--color-text); font-size: 0.875rem; border-bottom: 1px solid var(--color-border); }
.nav-dropdown li a:hover { background: var(--color-bg); color: var(--color-primary); text-decoration: none; }
.nav-item.has-dropdown:hover .nav-dropdown { display: block; }
@media (max-width: 768px) {
    .nav-toggle { display: block; }
    .nav-menu { display: none; flex-direction: column; width: 100%; background: var(--color-primary); }
    .nav-menu.open { display: flex; }
    .nav-dropdown { position: static; box-shadow: none; background: var(--color-primary-dk); }
    .nav-dropdown li a { color: rgba(255,255,255,.85); border-color: rgba(255,255,255,.1); }
}
```

**Section 5 — Slider:**
```css
.slider-wrapper { position: relative; overflow: hidden; background: #000; max-height: 450px; }
.slider-track { display: flex; transition: transform 0.4s ease; }
.slide { flex-shrink: 0; width: 100%; position: relative; }
.slide-img { width: 100%; max-height: 450px; object-fit: cover; }
.slide-caption { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,.65)); color: white; padding: 20px 24px 16px; font-size: 1rem; font-weight: 600; }
.slider-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,.4); color: white; border: none; padding: 12px 16px; cursor: pointer; font-size: 1.2rem; z-index: 10; transition: background var(--transition); }
.slider-btn:hover { background: rgba(0,0,0,.65); }
.slider-prev { left: 8px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.slider-next { right: 8px; border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.slider-dots { position: absolute; bottom: 12px; width: 100%; display: flex; justify-content: center; gap: 6px; }
.slider-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.5); cursor: pointer; border: none; }
.slider-dot.active { background: white; }
```

**Section 6 — Cards, Berita, Badge, Sidebar, Footer, Table, Preloader, Misc:**
```css
/* Card */
.card { background: var(--color-bg-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 16px; }
.card-header { padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.card-body { padding: 20px; }

/* Badge */
.badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; background: var(--color-primary); color: white; margin-bottom: 6px; }
.badge-sm { font-size: 0.7rem; padding: 2px 7px; }

/* Breadcrumb */
.breadcrumb { margin-bottom: 12px; }
.breadcrumb ol { display: flex; flex-wrap: wrap; gap: 4px; font-size: 0.8rem; }
.breadcrumb li + li::before { content: '/'; margin-right: 4px; color: var(--color-text-muted); }
.breadcrumb a { color: var(--color-primary); }
.breadcrumb [aria-current] { color: var(--color-text-muted); }

/* Headline (home) */
.home-headline { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 32px; }
.headline-main .headline-link { display: block; border-radius: var(--radius-md); overflow: hidden; background: white; box-shadow: var(--shadow-sm); }
.headline-img { width: 100%; height: 280px; object-fit: cover; }
.headline-body { padding: 16px; }
.headline-judul { font-size: 1.2rem; font-weight: 700; color: var(--color-text); line-height: 1.4; margin-top: 6px; }
.headline-side { display: flex; flex-direction: column; gap: 10px; }
.headline-side-item { display: flex; gap: 10px; background: white; border-radius: var(--radius-sm); padding: 10px; box-shadow: var(--shadow-sm); }
.headline-side-img { width: 80px; height: 70px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; }
.headline-side-judul { font-size: 0.875rem; font-weight: 600; color: var(--color-text); line-height: 1.3; }
@media (max-width: 768px) { .home-headline { grid-template-columns: 1fr; } }

/* Berita Grid (home per kategori) */
.home-body { display: flex; gap: 24px; }
.home-main { flex: 1; min-width: 0; }
.home-sidebar { width: 280px; flex-shrink: 0; }
@media (max-width: 768px) { .home-body { flex-direction: column; } .home-sidebar { width: 100%; } }
.section-header { display: flex; justify-content: space-between; align-items: center; margin: 24px 0 12px; border-left: 4px solid var(--color-primary); padding-left: 10px; }
.section-title { font-size: 1.1rem; font-weight: 700; }
.section-more { font-size: 0.8rem; color: var(--color-primary); }
.berita-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 768px) { .berita-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .berita-grid { grid-template-columns: 1fr; } }
.berita-card { background: white; border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); transition: box-shadow var(--transition); }
.berita-card:hover { box-shadow: var(--shadow-md); }
.berita-card-img { width: 100%; height: 150px; object-fit: cover; }
.berita-card-no-img { width: 100%; height: 150px; background: var(--color-bg); }
.berita-card-body { padding: 12px; }
.berita-card-judul { font-size: 0.875rem; font-weight: 600; line-height: 1.4; margin: 6px 0; }
.berita-card-excerpt { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 6px; }
.berita-card-tanggal { font-size: 0.75rem; color: var(--color-text-muted); }

/* Berita List */
.berita-list { display: flex; flex-direction: column; gap: 16px; }
.berita-list-item { display: flex; gap: 16px; background: white; border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); }
.berita-list-img { width: 160px; height: 120px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; }
.berita-list-no-img { width: 160px; height: 120px; background: var(--color-bg); border-radius: var(--radius-sm); flex-shrink: 0; }
.berita-list-judul { font-size: 1rem; font-weight: 700; margin: 6px 0; line-height: 1.4; }
.berita-list-excerpt { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 8px; }
.berita-list-meta { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 8px; }
.btn-more { font-size: 0.8rem; color: var(--color-primary); font-weight: 600; }
@media (max-width: 480px) { .berita-list-item { flex-direction: column; } .berita-list-img, .berita-list-no-img { width: 100%; } }

/* Artikel detail */
.artikel-detail .card-header { border-bottom: none; }
.artikel-judul { font-size: 1.5rem; font-weight: 700; line-height: 1.4; margin: 10px 0; }
.artikel-meta { font-size: 0.85rem; color: var(--color-text-muted); display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.share-buttons { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.share-label { font-size: 0.8rem; color: var(--color-text-muted); }
.share-btn { font-size: 0.75rem; padding: 4px 10px; border-radius: 3px; color: white; font-weight: 600; }
.share-fb { background: #1877f2; }
.share-tw { background: #1da1f2; }
.share-wa { background: #25d366; }
.artikel-thumbnail { margin: 0 0 20px; }
.artikel-img { width: 100%; max-height: 400px; object-fit: cover; border-radius: var(--radius-sm); }
.artikel-konten { font-size: 1rem; line-height: 1.8; }
.artikel-konten img { border-radius: var(--radius-sm); margin: 12px 0; }
.artikel-konten p { margin-bottom: 1em; }
.artikel-konten h2, .artikel-konten h3 { margin: 1.5em 0 .5em; font-weight: 700; }
.artikel-tags { padding: 12px 20px; border-top: 1px solid var(--color-border); display: flex; flex-wrap: wrap; gap: 6px; }
.tag { background: var(--color-bg); border: 1px solid var(--color-border); padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; }
.artikel-back { margin-top: 16px; }
.btn-back { font-size: 0.875rem; color: var(--color-primary); font-weight: 600; }

/* Sidebar */
.sidebar-widget { background: white; border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); margin-bottom: 16px; }
.sidebar-title { font-size: 0.95rem; font-weight: 700; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 2px solid var(--color-primary); color: var(--color-primary); }
.sidebar-berita { display: flex; flex-direction: column; gap: 12px; }
.sidebar-berita-item { display: flex; gap: 10px; }
.sidebar-berita-img { width: 60px; height: 50px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; }
.sidebar-berita-judul { font-size: 0.8rem; font-weight: 600; color: var(--color-text); line-height: 1.3; display: block; margin-bottom: 2px; }
.sidebar-berita-item time { font-size: 0.7rem; color: var(--color-text-muted); }

/* Pagination */
.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px; }
.page-btn { display: inline-block; padding: 8px 16px; background: var(--color-primary); color: white; border-radius: var(--radius-sm); font-size: 0.875rem; }
.page-btn:hover { background: var(--color-primary-lt); color: white; text-decoration: none; }
.page-info { font-size: 0.875rem; color: var(--color-text-muted); }

/* Download Table */
.download-search { margin-bottom: 16px; }
.input-search { width: 100%; max-width: 360px; padding: 8px 14px; border: 1px solid var(--color-border); border-radius: 20px; font-size: 0.875rem; outline: none; }
.table-responsive { overflow-x: auto; }
.download-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.download-table th { background: var(--color-primary); color: white; padding: 10px 14px; text-align: left; }
.download-table td { padding: 10px 14px; border-bottom: 1px solid var(--color-border); }
.download-table tr:hover td { background: var(--color-bg); }
.file-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.75rem; font-weight: 600; background: var(--color-text-muted); color: white; text-transform: uppercase; }
.file-badge.file-pdf { background: #c62828; }
.file-badge.file-doc, .file-badge.file-docx { background: #1565c0; }
.file-badge.file-xls, .file-badge.file-xlsx { background: #2e7d32; }
.btn-download { display: inline-block; padding: 5px 14px; background: var(--color-primary); color: white; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 600; }
.btn-download:hover { background: var(--color-primary-lt); color: white; text-decoration: none; }

/* Footer */
.site-footer { background: var(--color-primary-dk); color: rgba(255,255,255,.85); margin-top: 40px; }
.footer-body { padding: 40px 0; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 32px; }
@media (max-width: 768px) { .footer-grid { grid-template-columns: 1fr; } }
.footer-logo { height: 50px; width: auto; margin-bottom: 12px; filter: brightness(0) invert(1); }
.footer-nama-org { font-size: 1rem; font-weight: 700; color: white; margin-bottom: 6px; }
.footer-tagline { font-size: 0.8rem; opacity: .7; margin-bottom: 14px; }
.footer-sosmed { display: flex; gap: 10px; margin-top: 12px; }
.sosmed-link { color: rgba(255,255,255,.7); transition: color var(--transition); }
.sosmed-link:hover { color: white; }
.footer-heading { font-size: 0.9rem; font-weight: 700; color: white; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,.2); }
.footer-links li { margin-bottom: 6px; }
.footer-links a { font-size: 0.8rem; color: rgba(255,255,255,.7); }
.footer-links a:hover { color: white; text-decoration: none; }
.footer-berita li { margin-bottom: 10px; }
.footer-berita a { font-size: 0.8rem; color: rgba(255,255,255,.7); display: block; line-height: 1.3; }
.footer-berita a:hover { color: white; text-decoration: none; }
.footer-berita small { font-size: 0.7rem; opacity: .5; }
.footer-bottom { background: rgba(0,0,0,.25); padding: 14px 0; }
.footer-bottom p { font-size: 0.8rem; text-align: center; color: rgba(255,255,255,.6); }
.footer-bottom a { color: rgba(255,255,255,.8); }

/* Empty state */
.empty-state { text-align: center; padding: 40px; color: var(--color-text-muted); background: white; border-radius: var(--radius-md); }

/* Preloader */
.preloader { position: fixed; inset: 0; background: white; z-index: 9999; display: flex; align-items: center; justify-content: center; }
.preloader-spinner { width: 40px; height: 40px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/assets/css/style.css
git commit -m "feat(theme): add complete CSS stylesheet for default theme"
```

---

## Task 8: `assets/js/app.js` — Vanilla JS

**Files:**
- Create: `frontend/shared/themes/default/assets/js/app.js`

- [ ] Buat `app.js`:

```javascript
/* ObongCMS Default Theme — app.js */
(function () {
    'use strict';

    // --- Preloader ---
    window.addEventListener('load', function () {
        var preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.style.opacity = '0';
            setTimeout(function () { preloader.style.display = 'none'; }, 300);
        }
    });

    // --- Mobile menu toggle ---
    var navToggle = document.getElementById('nav-toggle');
    var navMenu = document.getElementById('nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function () {
            var isOpen = navMenu.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    // --- Highlight active menu item ---
    var currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function (link) {
        if (link.getAttribute('href') === currentPath ||
            (currentPath.startsWith(link.getAttribute('href')) && link.getAttribute('href') !== '/')) {
            link.classList.add('nav-link-active');
        }
    });

    // --- Slider ---
    var sliderTrack = document.getElementById('slider-track');
    if (sliderTrack) {
        var slides = sliderTrack.querySelectorAll('.slide');
        var dotsContainer = document.getElementById('slider-dots');
        var current = 0;
        var autoplayTimer = null;

        // Buat dots
        slides.forEach(function (_, i) {
            var dot = document.createElement('button');
            dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Slide ' + (i + 1));
            dot.addEventListener('click', function () { goTo(i); });
            dotsContainer.appendChild(dot);
        });

        function goTo(index) {
            current = (index + slides.length) % slides.length;
            sliderTrack.style.transform = 'translateX(-' + current * 100 + '%)';
            document.querySelectorAll('.slider-dot').forEach(function (d, i) {
                d.classList.toggle('active', i === current);
            });
        }

        function startAutoplay() {
            autoplayTimer = setInterval(function () { goTo(current + 1); }, 5000);
        }

        function stopAutoplay() { clearInterval(autoplayTimer); }

        var prevBtn = document.getElementById('slider-prev');
        var nextBtn = document.getElementById('slider-next');
        if (prevBtn) prevBtn.addEventListener('click', function () { stopAutoplay(); goTo(current - 1); startAutoplay(); });
        if (nextBtn) nextBtn.addEventListener('click', function () { stopAutoplay(); goTo(current + 1); startAutoplay(); });

        sliderTrack.parentElement.addEventListener('mouseenter', stopAutoplay);
        sliderTrack.parentElement.addEventListener('mouseleave', startAutoplay);

        if (slides.length > 1) startAutoplay();
    }

    // --- Search ---
    window.doSearch = function () {
        var input = document.getElementById('search-input');
        if (!input || !input.value.trim()) return;
        var q = input.value.trim();
        window.open('https://www.google.com/search?q=' + encodeURIComponent(q) +
            '+site%3A' + window.location.hostname, '_blank');
    };

    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') window.doSearch();
        });
    }

})();
```

- [ ] Commit:

```bash
git add frontend/shared/themes/default/assets/js/app.js
git commit -m "feat(theme): add vanilla JS for menu, slider, search"
```

---

## Task 9: Serve Default Theme Assets

**Files:**
- Modify: `frontend/modules/site/handler.go`

- [ ] Tambahkan route untuk serve embedded default theme assets:

```go
// Di Routes() — tambahkan handler untuk default theme assets
r.Handle("/assets/themes/default/*",
    http.StripPrefix("/assets/themes/default/",
        http.FileServer(http.FS(mustSubFS(themes.FS, "default/assets")))))
```

Helper:
```go
func mustSubFS(f fs.FS, dir string) fs.FS {
    sub, err := fs.Sub(f, dir)
    if err != nil {
        panic(err)
    }
    return sub
}
```

- [ ] Import `frontend/shared/themes` di handler.

- [ ] Build + test:

```bash
cd frontend && go build ./... && go test ./...
```

- [ ] Commit:

```bash
git add frontend/modules/site/handler.go
git commit -m "feat(theme): serve embedded default theme assets via /assets/themes/default/"
```
