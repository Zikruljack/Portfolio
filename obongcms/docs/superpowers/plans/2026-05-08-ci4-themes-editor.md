# CI4 Redaksi Themes Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi modul Tema di CI4 Redaksi — daftar tema, duplikat dari default, aktifkan, edit file tema aktif (code editor), upload asset, dan hapus tema.

**Architecture:** Modul baru `pages/redaksi/Tema/` mengikuti pola modul Redaksi lainnya (Controller + Routes + Views). Komunikasi ke Go Edge via library `GoEdge.php` yang diperluas dengan method tema. Themes editor menggunakan textarea (fallback) atau Monaco Editor (CDN) untuk edit file HTML/CSS/JS.

**Tech Stack:** CI4, Twig, `Base\Libraries\GoEdge`, Monaco Editor (CDN optional)

**Dependency:** Plan 1 (Go Edge Theme System) harus selesai — endpoint `/api/internal/theme/` harus ada.

**Referensi Spec:** `docs/superpowers/specs/2026-05-08-default-theme-design.md`

---

## File Map

| Status | Path | Peran |
|--------|------|-------|
| Modify | `backend/base/Libraries/GoEdge.php` | Tambah method tema: list, getFile, putFile, duplicate, activate, delete, uploadAsset |
| Create | `backend/pages/redaksi/Tema/Config/Routes.php` | Route modul Tema |
| Create | `backend/pages/redaksi/Tema/Controllers/Tema.php` | Controller: index, files, getFile, saveFile, duplicate, activate, delete, uploadAsset |
| Create | `backend/pages/redaksi/Tema/Views/index.twig` | Halaman daftar tema |
| Create | `backend/pages/redaksi/Tema/Views/files.twig` | Daftar file dalam tema aktif |
| Create | `backend/pages/redaksi/Tema/Views/editor.twig` | Halaman editor file tema |

---

## Task 1: Perluas `GoEdge.php` — Method Tema

**Files:**
- Modify: `backend/base/Libraries/GoEdge.php`

- [ ] Tambahkan method berikut ke class `GoEdge` (setelah method yang sudah ada):

```php
// =============================================
// THEME MANAGEMENT
// =============================================

/**
 * Ambil daftar tema tenant dari Go Edge.
 * Return: ['themes' => [...], 'active' => 'nama', 'max' => 4] atau null jika gagal.
 */
public function themeList(string $domain): ?array
{
    return $this->get("/api/internal/theme/{$domain}/list");
}

/**
 * Ambil daftar file dalam folder tema.
 * Return: ['files' => [...]] atau null.
 */
public function themeFiles(string $domain, string $themeName): ?array
{
    return $this->get("/api/internal/theme/{$domain}/{$themeName}/files");
}

/**
 * Ambil isi file tema.
 * Return: ['content' => '<string>'] atau null.
 */
public function themeFileGet(string $domain, string $themeName, string $filePath): ?array
{
    return $this->get("/api/internal/theme/{$domain}/{$themeName}/file?path=" . urlencode($filePath));
}

/**
 * Simpan isi file tema.
 */
public function themeFilePut(string $domain, string $themeName, string $filePath, string $content): bool
{
    return $this->post("/api/internal/theme/{$domain}/{$themeName}/file?path=" . urlencode($filePath), [
        'content' => $content,
    ]);
}

/**
 * Duplikat tema (dari 'default' atau nama tema lain).
 * $source = 'default' | nama tema existing.
 */
public function themeDuplicate(string $domain, string $source, string $newName): bool
{
    return $this->post("/api/internal/theme/{$domain}/duplicate", [
        'source' => $source,
        'name'   => $newName,
    ]);
}

/**
 * Aktifkan tema — Go Edge akan reload cache domain ini.
 */
public function themeActivate(string $domain, string $themeName): bool
{
    return $this->post("/api/internal/theme/{$domain}/{$themeName}/activate", []);
}

/**
 * Hapus tema. Tidak bisa hapus tema yang sedang aktif (Go Edge yang enforce).
 */
public function themeDelete(string $domain, string $themeName): bool
{
    return $this->delete("/api/internal/theme/{$domain}/{$themeName}");
}

/**
 * Upload file asset (CSS/JS/gambar) ke folder tema.
 * $filePath: path relatif dalam folder tema, misal "assets/css/custom.css"
 */
public function themeAssetUpload(string $domain, string $themeName, string $filePath, \CodeIgniter\HTTP\Files\UploadedFile $file): bool
{
    try {
        $curlFile = new \CURLFile(
            $file->getTempName(),
            $file->getMimeType() ?: 'application/octet-stream',
            $file->getClientName(),
        );

        $ch = curl_init($this->url . "/api/internal/theme/{$domain}/{$themeName}/upload");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => ['X-Internal-Secret: ' . $this->secret],
            CURLOPT_POSTFIELDS     => [
                'path' => $filePath,
                'file' => $curlFile,
            ],
        ]);

        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $status !== 200) {
            log_message('error', "GoEdge::themeAssetUpload — HTTP {$status}: {$body}");
            return false;
        }

        $result = json_decode($body, true);
        return isset($result['status']) && $result['status'] === true;
    } catch (\Throwable $e) {
        log_message('error', 'GoEdge::themeAssetUpload — ' . $e->getMessage());
        return false;
    }
}
```

- [ ] Tambahkan method private `get()` dan `delete()` di bagian bawah class (setelah `post()`):

```php
private function get(string $path): ?array
{
    try {
        $client   = Services::curlrequest(['timeout' => 10]);
        $response = $client->get($this->url . $path, [
            'headers' => ['X-Internal-Secret' => $this->secret],
        ]);
        $result = json_decode($response->getBody(), true);
        return (isset($result['status']) && $result['status'] === true) ? $result : null;
    } catch (\Throwable $e) {
        log_message('error', 'GoEdge::get ' . $path . ' — ' . $e->getMessage());
        return null;
    }
}

private function delete(string $path): bool
{
    try {
        $client   = Services::curlrequest(['timeout' => 10]);
        $response = $client->delete($this->url . $path, [
            'headers' => ['X-Internal-Secret' => $this->secret],
        ]);
        $result = json_decode($response->getBody(), true);
        return isset($result['status']) && $result['status'] === true;
    } catch (\Throwable $e) {
        log_message('error', 'GoEdge::delete ' . $path . ' — ' . $e->getMessage());
        return false;
    }
}
```

- [ ] Build check (tidak ada unit test di library ini — cukup pastikan syntax benar):

```bash
cd backend && php spark list 2>&1 | head -5
```

Expected: no PHP parse errors.

- [ ] Commit:

```bash
git add backend/base/Libraries/GoEdge.php
git commit -m "feat(ci4): extend GoEdge library with theme management methods"
```

---

## Task 2: Routes Modul Tema

**Files:**
- Create: `backend/pages/redaksi/Tema/Config/Routes.php`

- [ ] Buat `Routes.php`:

```php
<?php

$routes->group('redaksi/tema', ['namespace' => 'Redaksi\Tema\Controllers', 'filter' => 'auth'], function ($routes) {
    // Daftar tema
    $routes->get('/', 'Tema::index');

    // Duplikat tema
    $routes->post('duplicate', 'Tema::duplicate');

    // Aktifkan tema
    $routes->post('activate', 'Tema::activate');

    // Hapus tema
    $routes->post('delete', 'Tema::delete');

    // Daftar file dalam tema aktif
    $routes->get('files', 'Tema::files');

    // Buka editor untuk file tertentu
    $routes->get('editor', 'Tema::editor');

    // Simpan file dari editor
    $routes->post('save', 'Tema::save');

    // Upload asset
    $routes->post('upload', 'Tema::upload');
});
```

- [ ] Daftarkan route di `backend/app/Config/Routes.php` (atau file include yang sesuai dengan pola project):

```php
require_once APPPATH . '../pages/redaksi/Tema/Config/Routes.php';
```

- [ ] Commit:

```bash
git add backend/pages/redaksi/Tema/Config/Routes.php
git commit -m "feat(ci4): add Tema module routes"
```

---

## Task 3: Controller Tema

**Files:**
- Create: `backend/pages/redaksi/Tema/Controllers/Tema.php`

- [ ] Buat `Tema.php`:

```php
<?php

namespace Redaksi\Tema\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\GoEdge;
use Base\Libraries\Permission;

class Tema extends BaseController
{
    private GoEdge $edge;

    public function __construct()
    {
        $this->edge = new GoEdge();
    }

    // Halaman daftar tema
    public function index()
    {
        Permission::can('redaksi.tema.read');

        $domain = session('tenant_domain'); // domain tenant yang sedang login
        $result = $this->edge->themeList($domain);

        return twig()->render('index', [
            'themes' => $result['themes'] ?? [],
            'active' => $result['active'] ?? '',
            'max'    => $result['max'] ?? 4,
            'domain' => $domain,
        ]);
    }

    // Duplikat tema
    public function duplicate()
    {
        Permission::can('redaksi.tema.upsert');

        $domain  = session('tenant_domain');
        $source  = $this->request->getPost('source') ?? 'default';
        $name    = trim($this->request->getPost('name') ?? '');

        if (empty($name)) {
            return jsonError('name', 'Nama tema wajib diisi');
        }

        // Slug-ify nama: huruf kecil, spasi → tanda hubung
        $name = strtolower(preg_replace('/[^a-z0-9\-]/', '-', $name));

        $ok = $this->edge->themeDuplicate($domain, $source, $name);

        if (! $ok) {
            return jsonError('name', 'Gagal menduplikat tema. Mungkin sudah 4 tema atau nama sudah digunakan.');
        }

        return jsonSuccess('Tema berhasil diduplikat', [
            'redirect' => base_url('redaksi/tema'),
        ]);
    }

    // Aktifkan tema
    public function activate()
    {
        Permission::can('redaksi.tema.upsert');

        $domain    = session('tenant_domain');
        $themeName = $this->request->getPost('theme_name');

        if (empty($themeName)) {
            return jsonError('theme_name', 'Nama tema wajib diisi');
        }

        $ok = $this->edge->themeActivate($domain, $themeName);

        if (! $ok) {
            return jsonError('theme_name', 'Gagal mengaktifkan tema');
        }

        return jsonSuccess('Tema ' . $themeName . ' diaktifkan');
    }

    // Hapus tema
    public function delete()
    {
        Permission::can('redaksi.tema.delete');

        $domain    = session('tenant_domain');
        $themeName = $this->request->getPost('theme_name');

        if (empty($themeName)) {
            return jsonError('theme_name', 'Nama tema wajib diisi');
        }

        $ok = $this->edge->themeDelete($domain, $themeName);

        if (! $ok) {
            return jsonError('theme_name', 'Gagal menghapus tema. Tema aktif tidak bisa dihapus.');
        }

        return jsonSuccess('Tema dihapus');
    }

    // Daftar file dalam tema aktif
    public function files()
    {
        Permission::can('redaksi.tema.read');

        $domain    = session('tenant_domain');
        $themeList = $this->edge->themeList($domain);
        $active    = $themeList['active'] ?? '';

        if (empty($active)) {
            return redirect()->to('redaksi/tema')
                ->with('error', 'Tidak ada tema aktif. Aktifkan salah satu tema dulu.');
        }

        $result = $this->edge->themeFiles($domain, $active);

        return twig()->render('files', [
            'active'     => $active,
            'files'      => $result['files'] ?? [],
        ]);
    }

    // Buka editor untuk file tertentu
    public function editor()
    {
        Permission::can('redaksi.tema.upsert');

        $domain    = session('tenant_domain');
        $themeList = $this->edge->themeList($domain);
        $active    = $themeList['active'] ?? '';

        if (empty($active)) {
            return redirect()->to('redaksi/tema')
                ->with('error', 'Tidak ada tema aktif.');
        }

        $filePath = $this->request->getGet('path');
        if (empty($filePath)) {
            return redirect()->to('redaksi/tema/files');
        }

        $result  = $this->edge->themeFileGet($domain, $active, $filePath);
        $content = $result['content'] ?? '';

        // Tentukan mode editor berdasarkan ekstensi file
        $ext = pathinfo($filePath, PATHINFO_EXTENSION);
        $editorMode = match ($ext) {
            'html'        => 'html',
            'css'         => 'css',
            'js'          => 'javascript',
            default       => 'plaintext',
        };

        return twig()->render('editor', [
            'active'      => $active,
            'file_path'   => $filePath,
            'content'     => $content,
            'editor_mode' => $editorMode,
        ]);
    }

    // Simpan file dari editor
    public function save()
    {
        Permission::can('redaksi.tema.upsert');

        $domain    = session('tenant_domain');
        $themeList = $this->edge->themeList($domain);
        $active    = $themeList['active'] ?? '';

        if (empty($active)) {
            return jsonError('tema', 'Tidak ada tema aktif');
        }

        $filePath = $this->request->getPost('file_path');
        $content  = $this->request->getPost('content');

        if (empty($filePath)) {
            return jsonError('file_path', 'Path file wajib diisi');
        }

        $ok = $this->edge->themeFilePut($domain, $active, $filePath, $content ?? '');

        if (! $ok) {
            return jsonError('content', 'Gagal menyimpan file');
        }

        return jsonSuccess('File berhasil disimpan');
    }

    // Upload asset (CSS/JS/gambar)
    public function upload()
    {
        Permission::can('redaksi.tema.upsert');

        $domain    = session('tenant_domain');
        $themeList = $this->edge->themeList($domain);
        $active    = $themeList['active'] ?? '';

        if (empty($active)) {
            return jsonError('tema', 'Tidak ada tema aktif');
        }

        $filePath = $this->request->getPost('path');
        $file     = $this->request->getFile('file');

        if (empty($filePath)) {
            return jsonError('path', 'Path tujuan wajib diisi');
        }
        if (! $file || ! $file->isValid()) {
            return jsonError('file', 'File tidak valid');
        }

        $ok = $this->edge->themeAssetUpload($domain, $active, $filePath, $file);

        if (! $ok) {
            return jsonError('file', 'Gagal upload file');
        }

        return jsonSuccess('File berhasil di-upload');
    }
}
```

- [ ] Build check:

```bash
cd backend && php spark routes 2>&1 | grep -i tema
```

Expected: route `redaksi/tema` tampil di daftar.

- [ ] Commit:

```bash
git add backend/pages/redaksi/Tema/Controllers/Tema.php
git commit -m "feat(ci4): add Tema controller with full theme management"
```

---

## Task 4: View — Daftar Tema (`index.twig`)

**Files:**
- Create: `backend/pages/redaksi/Tema/Views/index.twig`

- [ ] Buat `index.twig`:

```twig
{% extends base_layout %}

{% block title %}Manajemen Tema{% endblock %}

{% block content %}
<div class="page-header d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0">Manajemen Tema</h4>
    {% if themes|length < max %}
    <button class="btn btn-primary btn-sm" data-toggle="modal" data-target="#modal-duplikat">
        <i class="fas fa-copy"></i> Duplikat Tema
    </button>
    {% else %}
    <span class="text-muted small">Maksimal {{ max }} tema tercapai. Hapus tema lain untuk membuat baru.</span>
    {% endif %}
</div>

{% if themes is empty %}
<div class="alert alert-info">
    Belum ada tema kustom. Klik "Duplikat Tema" untuk membuat tema yang bisa diedit.
    <br><small>Domain ini saat ini menggunakan tema default (tidak bisa diedit).</small>
</div>
{% else %}
<div class="row">
    {% for theme in themes %}
    <div class="col-md-4 mb-3">
        <div class="card {% if theme == active %}border-success{% endif %}">
            <div class="card-body">
                <h5 class="card-title">
                    {{ theme }}
                    {% if theme == active %}
                    <span class="badge badge-success ml-1">Aktif</span>
                    {% endif %}
                </h5>

                <div class="d-flex gap-2 mt-3 flex-wrap">
                    {% if theme == active %}
                    {# Tema aktif: bisa edit file #}
                    <a href="{{ base_url('redaksi/tema/files') }}" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-code"></i> Edit File
                    </a>
                    {% else %}
                    {# Tema tidak aktif: bisa aktifkan atau hapus #}
                    <button class="btn btn-sm btn-success btn-aktifkan" data-name="{{ theme }}">
                        <i class="fas fa-toggle-on"></i> Aktifkan
                    </button>
                    <button class="btn btn-sm btn-danger btn-hapus" data-name="{{ theme }}">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                    {% endif %}
                </div>
            </div>
        </div>
    </div>
    {% endfor %}
</div>
{% endif %}

{# Info default theme #}
<div class="card mt-3">
    <div class="card-body">
        <strong>default</strong>
        <span class="badge badge-secondary ml-1">Bawaan</span>
        {% if active is empty %}
        <span class="badge badge-success ml-1">Aktif</span>
        {% endif %}
        <p class="mb-1 small text-muted">Tema bawaan ObongCMS — tidak bisa diedit. Duplikat untuk membuat versi kustom.</p>
    </div>
</div>

{# Modal duplikat #}
<div class="modal fade" id="modal-duplikat" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Duplikat Tema</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="form-duplikat">
                    <div class="form-group">
                        <label>Nama Tema Baru</label>
                        <input type="text" name="name" class="form-control" placeholder="contoh: tema-hijau-saya" required>
                        <small class="text-muted">Huruf kecil dan tanda hubung saja. Misal: tema-biru, tema-ramadhan.</small>
                    </div>
                    <div class="form-group">
                        <label>Duplikat Dari</label>
                        <select name="source" class="form-control">
                            <option value="default">Default (bawaan)</option>
                            {% for theme in themes %}
                            <option value="{{ theme }}">{{ theme }}</option>
                            {% endfor %}
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Batal</button>
                <button type="button" class="btn btn-primary" id="btn-simpan-duplikat">Duplikat</button>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script>
// Duplikat tema
document.getElementById('btn-simpan-duplikat').addEventListener('click', function () {
    var form = document.getElementById('form-duplikat');
    var data = new FormData(form);
    fetch('{{ base_url("redaksi/tema/duplicate") }}', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: data
    }).then(r => r.json()).then(function (res) {
        if (res.status) {
            window.location.href = '{{ base_url("redaksi/tema") }}';
        } else {
            alert(res.message || 'Gagal menduplikat tema');
        }
    });
});

// Aktifkan tema
document.querySelectorAll('.btn-aktifkan').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var name = this.dataset.name;
        if (!confirm('Aktifkan tema "' + name + '"? Situs akan langsung menggunakan tema ini.')) return;
        var fd = new FormData();
        fd.append('theme_name', name);
        fetch('{{ base_url("redaksi/tema/activate") }}', {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: fd
        }).then(r => r.json()).then(function (res) {
            if (res.status) window.location.reload();
            else alert(res.message || 'Gagal mengaktifkan tema');
        });
    });
});

// Hapus tema
document.querySelectorAll('.btn-hapus').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var name = this.dataset.name;
        if (!confirm('Hapus tema "' + name + '"? Tindakan ini tidak bisa dibatalkan.')) return;
        var fd = new FormData();
        fd.append('theme_name', name);
        fetch('{{ base_url("redaksi/tema/delete") }}', {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: fd
        }).then(r => r.json()).then(function (res) {
            if (res.status) window.location.reload();
            else alert(res.message || 'Gagal menghapus tema');
        });
    });
});
</script>
{% endblock %}
```

- [ ] Commit:

```bash
git add backend/pages/redaksi/Tema/Views/index.twig
git commit -m "feat(ci4): add Tema index view (list + duplicate + activate + delete)"
```

---

## Task 5: View — Daftar File Tema (`files.twig`)

**Files:**
- Create: `backend/pages/redaksi/Tema/Views/files.twig`

- [ ] Buat `files.twig`:

```twig
{% extends base_layout %}

{% block title %}File Tema — {{ active }}{% endblock %}

{% block content %}
<div class="d-flex justify-content-between align-items-center mb-3">
    <div>
        <h4 class="mb-0">File Tema Aktif</h4>
        <small class="text-muted">Tema: <strong>{{ active }}</strong></small>
    </div>
    <a href="{{ base_url('redaksi/tema') }}" class="btn btn-secondary btn-sm">
        <i class="fas fa-arrow-left"></i> Kembali
    </a>
</div>

<div class="card">
    <div class="card-body p-0">
        <table class="table table-hover mb-0">
            <thead>
                <tr>
                    <th>File</th>
                    <th>Tipe</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                {% for file in files %}
                {% set ext = file|split('.')|last %}
                <tr>
                    <td><code>{{ file }}</code></td>
                    <td>
                        <span class="badge badge-secondary">{{ ext }}</span>
                    </td>
                    <td>
                        {% if ext in ['html', 'css', 'js', 'txt', 'json'] %}
                        <a href="{{ base_url('redaksi/tema/editor') }}?path={{ file|url_encode }}"
                           class="btn btn-xs btn-outline-primary">
                            <i class="fas fa-code"></i> Edit
                        </a>
                        {% else %}
                        <span class="text-muted small">Binary</span>
                        {% endif %}
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>
{% endblock %}
```

- [ ] Commit:

```bash
git add backend/pages/redaksi/Tema/Views/files.twig
git commit -m "feat(ci4): add Tema files list view"
```

---

## Task 6: View — Editor File (`editor.twig`)

**Files:**
- Create: `backend/pages/redaksi/Tema/Views/editor.twig`

- [ ] Buat `editor.twig`:

```twig
{% extends base_layout %}

{% block title %}Editor Tema — {{ file_path }}{% endblock %}

{% block head %}
{# Monaco Editor dari CDN #}
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
{% endblock %}

{% block content %}
<div class="d-flex justify-content-between align-items-center mb-3">
    <div>
        <h4 class="mb-0">Edit File Tema</h4>
        <small class="text-muted">
            Tema aktif: <strong>{{ active }}</strong> &rarr; <code>{{ file_path }}</code>
        </small>
    </div>
    <div class="d-flex gap-2">
        <a href="{{ base_url('redaksi/tema/files') }}" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i> Kembali
        </a>
        <button id="btn-save" class="btn btn-primary btn-sm">
            <i class="fas fa-save"></i> Simpan
        </button>
    </div>
</div>

{# Upload asset — hanya tampil untuk file CSS/JS #}
{% if file_path starts with 'assets/' %}
<div class="card mb-3">
    <div class="card-header py-2">
        <strong class="small">Upload File Asset</strong>
    </div>
    <div class="card-body py-2">
        <form id="form-upload" class="d-flex gap-2 align-items-center flex-wrap">
            <input type="file" name="file" class="form-control-file" style="max-width:300px">
            <input type="text" name="path" class="form-control" style="max-width:240px"
                placeholder="Path: assets/css/custom.css" value="assets/">
            <button type="submit" class="btn btn-sm btn-outline-primary">Upload</button>
        </form>
        <small class="text-muted">Upload file baru ke folder assets tema aktif.</small>
    </div>
</div>
{% endif %}

{# Monaco Editor container #}
<div class="card">
    <div class="card-body p-0">
        <div id="monaco-editor" style="height: 70vh; width: 100%;"></div>
    </div>
</div>

{# Fallback textarea (jika Monaco gagal load) #}
<div id="fallback-editor" style="display:none;">
    <div class="card">
        <div class="card-body p-2">
            <textarea id="textarea-editor" class="form-control" style="height:70vh; font-family: monospace; font-size: 13px;">{{ content }}</textarea>
        </div>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script>
var editorMode   = '{{ editor_mode }}';
var fileContent  = {{ content|json_encode|raw }};
var filePath     = '{{ file_path }}';
var saveUrl      = '{{ base_url("redaksi/tema/save") }}';
var uploadUrl    = '{{ base_url("redaksi/tema/upload") }}';
var monacoEditor = null;

// Init Monaco
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value:     fileContent,
        language:  editorMode,
        theme:     'vs',
        fontSize:  13,
        wordWrap:  'on',
        minimap:   { enabled: false },
        automaticLayout: true,
    });

    // Ctrl+S untuk simpan
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
        saveFile();
    });
}, function (err) {
    // Monaco gagal load — tampilkan fallback textarea
    document.getElementById('monaco-editor').closest('.card').style.display = 'none';
    document.getElementById('fallback-editor').style.display = 'block';
});

function getContent() {
    if (monacoEditor) return monacoEditor.getValue();
    return document.getElementById('textarea-editor').value;
}

function saveFile() {
    var btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    var fd = new FormData();
    fd.append('file_path', filePath);
    fd.append('content', getContent());

    fetch(saveUrl, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: fd
    }).then(r => r.json()).then(function (res) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
        if (res.status) {
            // Flash sukses singkat
            btn.classList.add('btn-success');
            btn.classList.remove('btn-primary');
            setTimeout(function () {
                btn.classList.remove('btn-success');
                btn.classList.add('btn-primary');
            }, 1500);
        } else {
            alert(res.message || 'Gagal menyimpan file');
        }
    });
}

document.getElementById('btn-save').addEventListener('click', saveFile);

// Upload asset
var formUpload = document.getElementById('form-upload');
if (formUpload) {
    formUpload.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(formUpload);
        fetch(uploadUrl, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: fd
        }).then(r => r.json()).then(function (res) {
            if (res.status) {
                alert('File berhasil di-upload ke: ' + fd.get('path'));
                formUpload.reset();
            } else {
                alert(res.message || 'Gagal upload');
            }
        });
    });
}
</script>
{% endblock %}
```

- [ ] Commit:

```bash
git add backend/pages/redaksi/Tema/Views/editor.twig
git commit -m "feat(ci4): add theme file editor view with Monaco Editor"
```

---

## Task 8: Tambahkan Permission Module

- [ ] Daftarkan permission `redaksi.tema.*` ke tabel `app_modules` via SQL migration:

```sql
INSERT INTO app_modules (modul, aksi, label, grup) VALUES
('redaksi.tema', 'read',   'Lihat Tema',     'Redaksi'),
('redaksi.tema', 'upsert', 'Edit Tema',      'Redaksi'),
('redaksi.tema', 'delete', 'Hapus Tema',     'Redaksi');
```

- [ ] Buat file migration: `backend/database/sql/migrations/redaksi_tema_modules.sql` (atau tambahkan ke migration yang ada sesuai konvensi project).

- [ ] Grant permission ke role `ADMIN_TENANT` (sesuai level yang punya akses redaksi):

```sql
-- Sesuaikan level_id untuk ADMIN_TENANT
INSERT INTO app_permissions (level_id, modul, aksi)
SELECT level_id, 'redaksi.tema', aksi
FROM (VALUES ('read'), ('upsert'), ('delete')) AS t(aksi)
CROSS JOIN (SELECT id AS level_id FROM app_users_level WHERE flag = 'ADMIN_TENANT') AS l;
```

- [ ] Commit:

```bash
git add backend/database/sql/migrations/redaksi_tema_modules.sql
git commit -m "feat(ci4): add permission modules for redaksi.tema"
```

---

## Task 9: Tambahkan Menu Navigasi Redaksi

- [ ] Cari file navigasi/sidebar Redaksi (biasanya di Views layout atau config) dan tambahkan link ke modul Tema:

```twig
{# Di sidebar/nav redaksi — cari pola yang sudah ada di views lain #}
{% if can('redaksi.tema.read') %}
<li class="nav-item">
    <a href="{{ base_url('redaksi/tema') }}" class="nav-link {% if uri_segment(2) == 'tema' %}active{% endif %}">
        <i class="fas fa-palette"></i> Tema
    </a>
</li>
{% endif %}
```

- [ ] Commit:

```bash
git add backend/
git commit -m "feat(ci4): add Tema menu to Redaksi sidebar"
```

---

## Catatan Penting

**`session('tenant_domain')`**: Sesuaikan cara ambil domain tenant dengan pola session yang sudah ada di modul Redaksi lain. Cek controller Redaksi lain (misalnya Berita atau Slider) untuk melihat cara yang benar.

**`jsonSuccess()` / `jsonError()`**: Fungsi ini diasumsikan ada sebagai global helper di CI4 project ini (terlihat di controller Slider). Jika berbeda namanya, sesuaikan dengan yang ada.

**`base_layout`**: Sesuaikan nama base layout Twig dengan yang dipakai modul Redaksi lain.
