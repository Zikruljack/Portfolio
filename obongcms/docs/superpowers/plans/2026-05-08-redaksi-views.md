# Redaksi Views — Modul Standar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi views + controller lengkap untuk 5 modul redaksi standar: Kategori, Halaman, Pengumuman, Slider, SEO — termasuk publish/unpublish ke Go Edge.

**Architecture:** Setiap modul mengikuti pattern Berita yang sudah berjalan: DataTable AJAX di index, form tambah/edit, publish/unpublish trigger `GoEdge::publishContent()`. Semua query wajib filter `tenant_id`. Tabel CMS dibuat via SQL migration.

**Tech Stack:** CI4 PHP 8.4, Twig 3, MySQL, `GoEdge` library (sudah ada di `base/Libraries/GoEdge.php`)

---

## File Map

| File | Status | Isi |
|------|--------|-----|
| `backend/database/sql/02_cms_tables.sql` | Buat baru | DDL semua tabel CMS redaksi |
| `backend/pages/redaksi/Kategori/Controllers/Kategori.php` | Modifikasi | Tambah `delete()` dengan relasi check + `tenant_id` filter |
| `backend/pages/redaksi/Kategori/Models/ValKategori.php` | Modifikasi | Tambah `tenant_id` |
| `backend/pages/redaksi/Kategori/Views/index.html` | Buat baru | DataTable kategori |
| `backend/pages/redaksi/Kategori/Views/form.html` | Buat baru | Form tambah/edit kategori |
| `backend/pages/redaksi/Halaman/Controllers/Halaman.php` | Modifikasi | Tambah `publish()`, `unpublish()`, `tenant_id` filter |
| `backend/pages/redaksi/Halaman/Models/ValHalaman.php` | Modifikasi | Update fields sesuai skema baru |
| `backend/pages/redaksi/Halaman/Views/index.html` | Buat baru | DataTable halaman |
| `backend/pages/redaksi/Halaman/Views/form.html` | Buat baru | Form tambah/edit halaman |
| `backend/pages/redaksi/Pengumuman/Controllers/Pengumuman.php` | Modifikasi | Tambah `publish()`, `unpublish()`, `tenant_id` filter |
| `backend/pages/redaksi/Pengumuman/Models/ValPengumuman.php` | Modifikasi | Update fields sesuai skema baru |
| `backend/pages/redaksi/Pengumuman/Views/index.html` | Buat baru | DataTable pengumuman |
| `backend/pages/redaksi/Pengumuman/Views/form.html` | Buat baru | Form tambah/edit pengumuman |
| `backend/pages/redaksi/Slider/Controllers/Slider.php` | Modifikasi | Tambah `toggleAktif()`, `tenant_id` filter, push slider.json |
| `backend/pages/redaksi/Slider/Models/ValSlider.php` | Modifikasi | Update fields |
| `backend/pages/redaksi/Slider/Views/index.html` | Buat baru | DataTable slider dengan toggle aktif |
| `backend/pages/redaksi/Slider/Views/form.html` | Buat baru | Form tambah/edit slider |
| `backend/pages/redaksi/Seo/Controllers/Seo.php` | Modifikasi | Implementasi lengkap |
| `backend/pages/redaksi/Seo/Views/index.html` | Buat baru | List SEO per konten |
| `backend/pages/redaksi/Seo/Views/form.html` | Buat baru | Form edit meta |

---

## Task 1: SQL — Tabel CMS

**Files:**
- Create: `backend/database/sql/02_cms_tables.sql`

- [ ] **Step 1: Buat file SQL baru dengan semua tabel CMS**

```sql
-- ============================================================
-- CMS Tables — ObongCMS Redaksi
-- ============================================================

CREATE TABLE IF NOT EXISTS `cms_berita_kategori` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `tenant_id`  INT          NOT NULL,
    `nama`       VARCHAR(100) NOT NULL,
    `slug`       VARCHAR(100) NOT NULL,
    `deskripsi`  TEXT         NULL,
    `urutan`     INT          NOT NULL DEFAULT 0,
    `status`     ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
    `created_at` DATETIME     NULL,
    `created_by` VARCHAR(100) NULL,
    `modified_at` DATETIME    NULL,
    `modified_by` VARCHAR(100) NULL,
    `deleted_at` DATETIME     NULL,
    `deleted_by` VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_kategori_slug_tenant` (`tenant_id`, `slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cms_halaman` (
    `id`               INT          NOT NULL AUTO_INCREMENT,
    `tenant_id`        INT          NOT NULL,
    `judul`            VARCHAR(255) NOT NULL,
    `slug`             VARCHAR(200) NOT NULL,
    `isi`              LONGTEXT     NULL,
    `status`           ENUM('draft','terbit') NOT NULL DEFAULT 'draft',
    `meta_title`       VARCHAR(200) NULL,
    `meta_description` TEXT         NULL,
    `og_image`         VARCHAR(500) NULL,
    `tanggal_terbit`   DATE         NULL,
    `created_at`       DATETIME     NULL,
    `created_by`       VARCHAR(100) NULL,
    `modified_at`      DATETIME     NULL,
    `modified_by`      VARCHAR(100) NULL,
    `deleted_at`       DATETIME     NULL,
    `deleted_by`       VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_halaman_slug_tenant` (`tenant_id`, `slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cms_pengumuman` (
    `id`              INT          NOT NULL AUTO_INCREMENT,
    `tenant_id`       INT          NOT NULL,
    `judul`           VARCHAR(255) NOT NULL,
    `slug`            VARCHAR(200) NOT NULL,
    `ringkasan`       TEXT         NULL,
    `status`          ENUM('draft','terbit') NOT NULL DEFAULT 'draft',
    `tanggal_mulai`   DATE         NULL,
    `tanggal_selesai` DATE         NULL,
    `tanggal_terbit`  DATE         NULL,
    `created_at`      DATETIME     NULL,
    `created_by`      VARCHAR(100) NULL,
    `modified_at`     DATETIME     NULL,
    `modified_by`     VARCHAR(100) NULL,
    `deleted_at`      DATETIME     NULL,
    `deleted_by`      VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_pengumuman_slug_tenant` (`tenant_id`, `slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cms_slider` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `tenant_id`  INT          NOT NULL,
    `judul`      VARCHAR(255) NULL,
    `gambar`     VARCHAR(500) NOT NULL,
    `link`       VARCHAR(500) NULL,
    `urutan`     INT          NOT NULL DEFAULT 0,
    `aktif`      TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at` DATETIME     NULL,
    `created_by` VARCHAR(100) NULL,
    `modified_at` DATETIME    NULL,
    `modified_by` VARCHAR(100) NULL,
    `deleted_at` DATETIME     NULL,
    `deleted_by` VARCHAR(100) NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kolom meta_title + meta_description + og_image untuk berita (jika belum ada)
ALTER TABLE `cms_berita`
    ADD COLUMN IF NOT EXISTS `meta_title`       VARCHAR(200) NULL AFTER `isi`,
    ADD COLUMN IF NOT EXISTS `meta_description` TEXT         NULL AFTER `meta_title`,
    ADD COLUMN IF NOT EXISTS `og_image`         VARCHAR(500) NULL AFTER `meta_description`;
```

- [ ] **Step 2: Jalankan SQL**

```bash
mysql -u root -p obongcms < backend/database/sql/02_cms_tables.sql
```

Expected: tidak ada error. Jika tabel sudah ada sebagian, `IF NOT EXISTS` akan skip.

- [ ] **Step 3: Verifikasi**

```bash
mysql -u root -p obongcms -e "SHOW TABLES LIKE 'cms_%';"
```

Expected output: `cms_berita_kategori`, `cms_halaman`, `cms_pengumuman`, `cms_slider` (+ tabel lain yang sudah ada)

- [ ] **Step 4: Commit**

```bash
git add backend/database/sql/02_cms_tables.sql
git commit -m "feat: tambah DDL tabel CMS redaksi (kategori, halaman, pengumuman, slider)"
```

---

## Task 2: Modul Kategori — Controller + Views

**Files:**
- Modify: `backend/pages/redaksi/Kategori/Controllers/Kategori.php`
- Modify: `backend/pages/redaksi/Kategori/Models/ValKategori.php`
- Modify: `backend/pages/redaksi/Kategori/Views/index.html`
- Modify: `backend/pages/redaksi/Kategori/Views/form.html`

- [ ] **Step 1: Update ValKategori — tambah tenant_id**

```php
<?php

namespace Redaksi\Kategori\Models;

use Base\Models\BaseModel;

class ValKategori extends BaseModel
{
    protected $table  = 'cms_berita_kategori';
    protected $fields = [
        'tenant_id' => '`rules=permit_empty|is_natural_no_zero`',
        'nama'      => '`rules=required|string|max_length[100]`',
        'slug'      => '`rules=permit_empty|string|max_length[100]`',
        'deskripsi' => '`rules=permit_empty|string`',
        'urutan'    => '`rules=permit_empty|integer`',
        'status'    => '`rules=permit_empty|in_list[aktif,nonaktif]`',
    ];
}
```

- [ ] **Step 2: Update controller Kategori.php**

```php
<?php

namespace Redaksi\Kategori\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\Datatable;
use Base\Libraries\Permission;
use Config\Database;
use Redaksi\Kategori\Models\ValKategori;

class Kategori extends BaseController
{
    public function index()
    {
        Permission::can('redaksi.kategori.read');
        return twig()->render('index');
    }

    public function jsonData()
    {
        Permission::can('redaksi.kategori.read');

        $tenantId = (int) tenant_id();
        $dt       = new Datatable();
        $dt->useKey(true);
        $dt->setQuery(
            "SELECT id, nama, slug, urutan, status
             FROM cms_berita_kategori
             WHERE deleted_at IS NULL AND tenant_id = {$tenantId}
             __and_where__ GROUP BY id __order__ __limit_offset__"
        );
        $dt->setColumn([
            'id(d)'      => static fn ($row) => encrypt($row->id),
            'nama(ds)',
            'slug(ds)',
            'urutan(ds)',
            'status(ds)',
        ]);

        return $dt->getJson();
    }

    public function create()
    {
        Permission::can('redaksi.kategori.upsert');

        $tenantId = (int) tenant_id();
        $model    = new ValKategori();
        $kategori = null;
        $id       = get('id');

        if ($id) {
            $kategori = $model->where('tenant_id', $tenantId)->find(decrypt($id));
        }

        return twig()->render('form', ['kategori' => $kategori]);
    }

    public function store()
    {
        Permission::can('redaksi.kategori.upsert');

        $validation = service('validation');
        $model      = new ValKategori();

        if (! $validation->valid($model)) {
            return $validation->errors();
        }

        $validated            = $validation->validated();
        $validated['tenant_id'] = (int) tenant_id();

        if (empty($validated['slug']) && ! empty($validated['nama'])) {
            $validated['slug'] = makeSlug($validated['nama']);
        }

        // Validasi slug unique per tenant
        $existing = (new ValKategori())
            ->where('tenant_id', $validated['tenant_id'])
            ->where('slug', $validated['slug'])
            ->where('deleted_at IS NULL');

        $editId = $this->request->getPost('id');
        if ($editId) {
            $existing->where('id !=', decrypt($editId));
        }

        if ($existing->first()) {
            return jsonErrors(['slug' => 'Slug sudah digunakan oleh kategori lain']);
        }

        $model->upsert($validated);

        return $validation->success('/redaksi/kategori');
    }

    public function delete()
    {
        Permission::can('redaksi.kategori.delete');

        $tenantId = (int) tenant_id();
        $id       = decrypt(get('id'));

        // Cek apakah masih ada berita yang pakai kategori ini
        $jumlah = Database::connect()
            ->table('cms_berita')
            ->where('tenant_id', $tenantId)
            ->where('kategori_id', $id)
            ->where('deleted_at IS NULL')
            ->countAllResults();

        if ($jumlah > 0) {
            return jsonErrors(['id' => "Tidak bisa dihapus — masih ada {$jumlah} berita di kategori ini"]);
        }

        Database::connect()->table('cms_berita_kategori')->update([
            'deleted_at' => date('Y-m-d H:i:s'),
            'deleted_by' => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        return jsonSuccess('Kategori berhasil dihapus');
    }
}
```

- [ ] **Step 3: Buat view index.html**

```twig
{% extends "base.html" %}
{% block title %}Kategori Berita{% endblock %}
{% block page_title %}Kategori Berita{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-gray-900">Kategori</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/kategori/create" class="btn btn-sm btn-primary">
    <i class="ki-outline ki-plus fs-4"></i> Tambah Kategori
</a>
{% endblock %}

{% block content %}
<div class="card">
    <div class="card-header border-0 pt-6">
        <div class="card-title"><span class="fw-bold fs-3">Data Kategori</span></div>
    </div>
    <div class="card-body pt-0">
        <table id="kategoriTable" class="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
                <tr class="fw-bold text-muted">
                    <th class="min-w-50px">No.</th>
                    <th class="min-w-200px">Nama</th>
                    <th class="min-w-150px">Slug</th>
                    <th class="min-w-80px">Urutan</th>
                    <th class="min-w-80px">Status</th>
                    <th class="min-w-100px text-end">Aksi</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<script>
$(document).ready(function () {
    $('.menu-kategori').addClass('active');
    var table = $('#kategoriTable').DataTable({
        searchDelay: 500, pageLength: 25, processing: false, serverSide: true,
        order: [[3, 'asc']],
        columnDefs: [{ targets: [0], orderable: false }],
        ajax: { url: '/redaksi/kategori/json-data' },
        columns: [
            { data: 'line', className: 'text-gray-600 fw-bold' },
            { data: 'nama', className: 'text-gray-800 fw-semibold' },
            { data: 'slug', className: 'text-muted fs-7' },
            { data: 'urutan' },
            {
                data: 'status',
                render: function (d) {
                    var cls = d === 'aktif' ? 'success' : 'secondary';
                    return '<span class="badge badge-light-' + cls + '">' + d + '</span>';
                }
            },
            {
                data: null, className: 'text-end', orderable: false,
                render: function (d) {
                    return '<div class="d-flex justify-content-end gap-2">'
                        + '<a href="/redaksi/kategori/create?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-primary btn-sm" title="Edit"><i class="ki-outline ki-pencil fs-4"></i></a>'
                        + '<a href="/redaksi/kategori/delete?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm btn-delete" title="Hapus"><i class="ki-outline ki-trash fs-4"></i></a>'
                        + '</div>';
                }
            }
        ],
    });
    $(document).on('click', '.btn-delete', function (e) { ajaxDelete($(this), e, table); });
});
</script>
{% endblock %}
```

- [ ] **Step 4: Buat view form.html**

```twig
{% extends "base.html" %}
{% block title %}{{ kategori ? 'Edit' : 'Tambah' }} Kategori{% endblock %}
{% block page_title %}{{ kategori ? 'Edit' : 'Tambah' }} Kategori{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-muted"><a href="/redaksi/kategori" class="text-muted text-hover-primary">Kategori</a></li>
<li class="breadcrumb-item text-gray-900">{{ kategori ? 'Edit' : 'Tambah' }}</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/kategori" class="btn btn-sm btn-secondary"><i class="ki-outline ki-arrow-left fs-4"></i> Kembali</a>
{% endblock %}

{% block content %}
<div class="card mw-600px mx-auto">
    <div class="card-body pt-6">
        <form id="kategoriForm">
            <input type="hidden" name="id" value="{{ kategori.id|encrypt }}">
            <div class="mb-5">
                <label class="form-label fw-semibold required">Nama Kategori</label>
                <input type="text" class="form-control" name="nama" id="namaKategori" value="{{ kategori.nama }}" required>
                <div class="val-error nama text-danger fs-7 mt-1"></div>
            </div>
            <div class="mb-5">
                <label class="form-label fw-semibold">Slug</label>
                <input type="text" class="form-control" name="slug" id="slugKategori" value="{{ kategori.slug }}" placeholder="otomatis-dari-nama">
                <div class="val-error slug text-danger fs-7 mt-1"></div>
            </div>
            <div class="mb-5">
                <label class="form-label fw-semibold">Urutan</label>
                <input type="number" class="form-control" name="urutan" value="{{ kategori.urutan ?: 0 }}">
            </div>
            <div class="mb-5">
                <label class="form-label fw-semibold">Status</label>
                <select class="form-select" name="status">
                    <option value="aktif" {{ kategori.status == 'aktif' or not kategori ? 'selected' : '' }}>Aktif</option>
                    <option value="nonaktif" {{ kategori.status == 'nonaktif' ? 'selected' : '' }}>Nonaktif</option>
                </select>
            </div>
            <div class="text-end">
                <button type="button" class="btn btn-primary" id="btnSimpan">Simpan</button>
            </div>
        </form>
    </div>
</div>

<script>
$('#namaKategori').on('input', function () {
    if (!$('#slugKategori').data('manual')) {
        $('#slugKategori').val($(this).val().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
});
$('#slugKategori').on('input', function () { $(this).data('manual', true); });

$('#btnSimpan').on('click', function () {
    ajaxSubmit($('#kategoriForm'), '/redaksi/kategori/create', '/redaksi/kategori');
});
</script>
{% endblock %}
```

- [ ] **Step 5: Commit**

```bash
git add backend/pages/redaksi/Kategori/
git commit -m "feat: implementasi modul Kategori (controller + views + tenant filter + relasi check)"
```

---

## Task 3: Modul Halaman — Controller + Views

**Files:**
- Modify: `backend/pages/redaksi/Halaman/Controllers/Halaman.php`
- Modify: `backend/pages/redaksi/Halaman/Models/ValHalaman.php`
- Modify: `backend/pages/redaksi/Halaman/Views/index.html`
- Modify: `backend/pages/redaksi/Halaman/Views/form.html`
- Modify: `backend/pages/redaksi/Halaman/Config/Routes.php`

- [ ] **Step 1: Update ValHalaman**

```php
<?php

namespace Redaksi\Halaman\Models;

use Base\Models\BaseModel;

class ValHalaman extends BaseModel
{
    protected $table  = 'cms_halaman';
    protected $fields = [
        'tenant_id'        => '`rules=permit_empty|is_natural_no_zero`',
        'judul'            => '`rules=required|string|max_length[255]`',
        'slug'             => '`rules=required|string|max_length[200]`',
        'isi'              => '`rules=permit_empty|string` `form=safe`',
        'status'           => '`rules=permit_empty|in_list[draft,terbit]`',
        'meta_title'       => '`rules=permit_empty|string|max_length[200]`',
        'meta_description' => '`rules=permit_empty|string`',
        'og_image'         => '`rules=permit_empty|string|max_length[500]`',
        'tanggal_terbit'   => '`rules=permit_empty|string`',
    ];
}
```

- [ ] **Step 2: Tambah routes publish/unpublish**

```php
<?php

$routes->group('redaksi/halaman', ['namespace' => 'Redaksi\Halaman\Controllers'], static function ($routes) {
    $routes->get('/',              'Halaman::index');
    $routes->get('json-data',      'Halaman::jsonData');
    $routes->get('create',         'Halaman::create');
    $routes->post('create',        'Halaman::store');
    $routes->post('publish',       'Halaman::publish');
    $routes->post('unpublish',     'Halaman::unpublish');
    $routes->get('delete',         'Halaman::delete');
});
```

- [ ] **Step 3: Update controller Halaman.php**

```php
<?php

namespace Redaksi\Halaman\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\Datatable;
use Base\Libraries\GoEdge;
use Base\Libraries\Permission;
use Config\Database;
use Redaksi\Halaman\Models\ValHalaman;

class Halaman extends BaseController
{
    public function index()
    {
        Permission::can('redaksi.halaman.read');
        return twig()->render('index');
    }

    public function jsonData()
    {
        Permission::can('redaksi.halaman.read');

        $tenantId = (int) tenant_id();
        $dt       = new Datatable();
        $dt->useKey(true);
        $dt->setQuery(
            "SELECT id, judul, slug, status, tanggal_terbit
             FROM cms_halaman
             WHERE deleted_at IS NULL AND tenant_id = {$tenantId}
             __and_where__ GROUP BY id __order__ __limit_offset__"
        );
        $dt->setColumn([
            'id(d)'           => static fn ($row) => encrypt($row->id),
            'judul(ds)',
            'slug(ds)',
            'status(ds)',
            'tanggal_terbit(ds)',
        ]);

        return $dt->getJson();
    }

    public function create()
    {
        Permission::can('redaksi.halaman.upsert');

        $tenantId = (int) tenant_id();
        $halaman  = null;
        $id       = get('id');

        if ($id) {
            $halaman = (new ValHalaman())->where('tenant_id', $tenantId)->find(decrypt($id));
        }

        return twig()->render('form', ['halaman' => $halaman]);
    }

    public function store()
    {
        Permission::can('redaksi.halaman.upsert');

        $validation = service('validation');
        $model      = new ValHalaman();

        if (! $validation->valid($model)) {
            return $validation->errors();
        }

        $validated            = $validation->validated();
        $tenantId             = (int) tenant_id();
        $validated['tenant_id'] = $tenantId;

        if (! empty($validated['isi'])) {
            $validated['isi'] = extractBase64Images($validated['isi']);
            $validated['isi'] = sanitizeHtml($validated['isi']);
        }

        // Validasi slug unique per tenant
        $existing = (new ValHalaman())
            ->where('tenant_id', $tenantId)
            ->where('slug', $validated['slug'])
            ->where('deleted_at IS NULL');

        $editId = $this->request->getPost('id');
        if ($editId) {
            $existing->where('id !=', decrypt($editId));
        }
        if ($existing->first()) {
            return jsonErrors(['slug' => 'Slug sudah digunakan oleh halaman lain']);
        }

        $action = $this->request->getPost('action');
        if ($action === 'publish') {
            $validated['status']         = 'terbit';
            $validated['tanggal_terbit'] = $validated['tanggal_terbit'] ?: date('Y-m-d');
        } else {
            $validated['status'] = 'draft';
        }

        $model->upsert($validated);

        if ($validated['status'] === 'terbit') {
            $saved = (new ValHalaman())->where('tenant_id', $tenantId)->where('slug', $validated['slug'])->first();
            $this->triggerPublish($saved, $tenantId);
        }

        return $validation->success('/redaksi/halaman');
    }

    public function publish()
    {
        Permission::can('redaksi.halaman.upsert');

        $id       = decrypt($this->request->getPost('id'));
        $tenantId = (int) tenant_id();
        $halaman  = (new ValHalaman())->where('tenant_id', $tenantId)->find($id);

        if (! $halaman) {
            return jsonErrors(['id' => 'Halaman tidak ditemukan']);
        }

        Database::connect()->table('cms_halaman')->update([
            'status'         => 'terbit',
            'tanggal_terbit' => $halaman->tanggal_terbit ?: date('Y-m-d'),
            'modified_at'    => date('Y-m-d H:i:s'),
            'modified_by'    => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        $halaman->status = 'terbit';
        $this->triggerPublish($halaman, $tenantId);

        return jsonSuccess('Halaman berhasil dipublish');
    }

    public function unpublish()
    {
        Permission::can('redaksi.halaman.upsert');

        $id       = decrypt($this->request->getPost('id'));
        $tenantId = (int) tenant_id();
        $halaman  = (new ValHalaman())->where('tenant_id', $tenantId)->find($id);

        if (! $halaman) {
            return jsonErrors(['id' => 'Halaman tidak ditemukan']);
        }

        Database::connect()->table('cms_halaman')->update([
            'status'      => 'draft',
            'modified_at' => date('Y-m-d H:i:s'),
            'modified_by' => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        $domain = $this->getDomainForTenant($tenantId);
        if ($domain) {
            $goEdge = new GoEdge();
            $goEdge->unpublishContent($domain, 'halaman', $halaman->slug);
            $this->rebuildHalamanList($domain, $tenantId);
        }

        return jsonSuccess('Halaman berhasil di-unpublish');
    }

    public function delete()
    {
        Permission::can('redaksi.halaman.delete');

        $tenantId = (int) tenant_id();
        $id       = decrypt(get('id'));
        $halaman  = (new ValHalaman())->where('tenant_id', $tenantId)->find($id);

        if ($halaman && $halaman->status === 'terbit') {
            $domain = $this->getDomainForTenant($tenantId);
            if ($domain) {
                (new GoEdge())->unpublishContent($domain, 'halaman', $halaman->slug);
                $this->rebuildHalamanList($domain, $tenantId);
            }
        }

        Database::connect()->table('cms_halaman')->update([
            'deleted_at' => date('Y-m-d H:i:s'),
            'deleted_by' => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        return jsonSuccess('Halaman berhasil dihapus');
    }

    private function triggerPublish($halaman, int $tenantId): void
    {
        $domain = $this->getDomainForTenant($tenantId);
        if (! $domain || ! $halaman) {
            return;
        }

        $detail = [
            'slug'             => $halaman->slug,
            'judul'            => $halaman->judul,
            'isi'              => $halaman->isi ?? '',
            'meta_title'       => $halaman->meta_title ?? '',
            'meta_description' => $halaman->meta_description ?? '',
            'og_image'         => $halaman->og_image ?? '',
            'tanggal_terbit'   => $halaman->tanggal_terbit ?? '',
        ];

        $db        = Database::connect();
        $allPages  = $db->table('cms_halaman')
            ->select('slug, judul, tanggal_terbit')
            ->where('tenant_id', $tenantId)
            ->where('status', 'terbit')
            ->where('deleted_at IS NULL')
            ->orderBy('judul', 'ASC')
            ->get()->getResult();

        $listItems = array_map(fn ($p) => [
            'slug'           => $p->slug,
            'judul'          => $p->judul,
            'tanggal_terbit' => $p->tanggal_terbit ?? '',
        ], $allPages);

        $goEdge = new GoEdge();
        $goEdge->publishContent($domain, [
            ['path' => 'halaman/' . $halaman->slug . '.json', 'content' => json_encode($detail, JSON_UNESCAPED_UNICODE)],
            ['path' => 'halaman.json', 'content' => json_encode(['items' => $listItems, 'updated_at' => date('c')], JSON_UNESCAPED_UNICODE)],
        ]);
    }

    private function rebuildHalamanList(string $domain, int $tenantId): void
    {
        $db       = Database::connect();
        $allPages = $db->table('cms_halaman')
            ->select('slug, judul, tanggal_terbit')
            ->where('tenant_id', $tenantId)
            ->where('status', 'terbit')
            ->where('deleted_at IS NULL')
            ->orderBy('judul', 'ASC')
            ->get()->getResult();

        $items = array_map(fn ($p) => [
            'slug'           => $p->slug,
            'judul'          => $p->judul,
            'tanggal_terbit' => $p->tanggal_terbit ?? '',
        ], $allPages);

        (new GoEdge())->publishContent($domain, [
            ['path' => 'halaman.json', 'content' => json_encode(['items' => $items, 'updated_at' => date('c')], JSON_UNESCAPED_UNICODE)],
        ]);
    }

    private function getDomainForTenant(int $tenantId): ?string
    {
        $row = Database::connect()->table('app_domains')
            ->select('host')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->where('status', 'aktif')
            ->get()->getRow();

        return $row ? $row->host : null;
    }
}
```

- [ ] **Step 4: Buat view index.html**

```twig
{% extends "base.html" %}
{% block title %}Halaman Statis{% endblock %}
{% block page_title %}Halaman Statis{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-gray-900">Halaman</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/halaman/create" class="btn btn-sm btn-primary">
    <i class="ki-outline ki-plus fs-4"></i> Tambah Halaman
</a>
{% endblock %}

{% block content %}
<div class="card">
    <div class="card-header border-0 pt-6">
        <div class="card-title"><span class="fw-bold fs-3">Data Halaman</span></div>
    </div>
    <div class="card-body pt-0">
        <table id="halamanTable" class="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
                <tr class="fw-bold text-muted">
                    <th class="min-w-50px">No.</th>
                    <th class="min-w-300px">Halaman</th>
                    <th class="min-w-100px text-end">Aksi</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<script>
$(document).ready(function () {
    $('.menu-halaman').addClass('active');
    var table = $('#halamanTable').DataTable({
        searchDelay: 500, pageLength: 25, processing: false, serverSide: true,
        order: [[1, 'asc']],
        columnDefs: [{ targets: [0], orderable: false }],
        ajax: { url: '/redaksi/halaman/json-data' },
        columns: [
            { data: 'line', className: 'text-gray-600 fw-bold' },
            {
                data: null,
                render: function (d) {
                    var st = d.status === 'terbit' ? 'success' : 'warning';
                    var lbl = d.status === 'terbit' ? 'Terbit' : 'Draft';
                    return '<div class="d-flex flex-column">'
                        + '<span class="text-gray-800 fw-bold mb-1">' + d.judul + ' <span class="badge badge-light-' + st + ' ms-1">' + lbl + '</span></span>'
                        + '<span class="text-muted fs-7">/' + d.slug + '</span>'
                        + '</div>';
                }
            },
            {
                data: null, className: 'text-end', orderable: false,
                render: function (d) {
                    var btns = '<a href="/redaksi/halaman/create?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-primary btn-sm" title="Edit"><i class="ki-outline ki-pencil fs-4"></i></a>';
                    if (d.status === 'draft') {
                        btns += '<button class="btn btn-icon btn-bg-light btn-active-color-success btn-sm btn-publish" data-id="' + d.id + '" title="Publish"><i class="ki-outline ki-send fs-4"></i></button>';
                    } else {
                        btns += '<button class="btn btn-icon btn-bg-light btn-active-color-warning btn-sm btn-unpublish" data-id="' + d.id + '" title="Unpublish"><i class="ki-outline ki-archive-tick fs-4"></i></button>';
                    }
                    btns += '<a href="/redaksi/halaman/delete?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm btn-delete" title="Hapus"><i class="ki-outline ki-trash fs-4"></i></a>';
                    return '<div class="d-flex justify-content-end gap-2">' + btns + '</div>';
                }
            }
        ],
    });
    $(document).on('click', '.btn-delete', function (e) { ajaxDelete($(this), e, table); });
    $(document).on('click', '.btn-publish', function () {
        var id = $(this).data('id');
        if (!confirm('Publish halaman ini ke situs publik?')) return;
        $.post('/redaksi/halaman/publish', { id: id }, function (res) {
            if (res.status) table.ajax.reload(null, false);
            else alert(res.message || 'Gagal');
        });
    });
    $(document).on('click', '.btn-unpublish', function () {
        var id = $(this).data('id');
        if (!confirm('Tarik halaman ini dari situs publik?')) return;
        $.post('/redaksi/halaman/unpublish', { id: id }, function (res) {
            if (res.status) table.ajax.reload(null, false);
            else alert(res.message || 'Gagal');
        });
    });
});
</script>
{% endblock %}
```

- [ ] **Step 5: Buat view form.html**

```twig
{% extends "base.html" %}
{% block title %}{{ halaman ? 'Edit' : 'Tambah' }} Halaman{% endblock %}
{% block page_title %}{{ halaman ? 'Edit' : 'Tambah' }} Halaman{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-muted"><a href="/redaksi/halaman" class="text-muted text-hover-primary">Halaman</a></li>
<li class="breadcrumb-item text-gray-900">{{ halaman ? 'Edit' : 'Tambah' }}</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/halaman" class="btn btn-sm btn-secondary"><i class="ki-outline ki-arrow-left fs-4"></i> Kembali</a>
{% endblock %}

{% block content %}
<form id="halamanForm" method="POST">
    <input type="hidden" name="id" value="{{ halaman.id|encrypt }}">

    <div class="row g-5">
        <div class="col-xl-8">
            <div class="card mb-5">
                <div class="card-header border-0 pt-5"><h3 class="card-title fw-bold fs-5">Konten Halaman</h3></div>
                <div class="card-body pt-3">
                    <div class="mb-5">
                        <label class="form-label fw-semibold required">Judul</label>
                        <input type="text" class="form-control" name="judul" value="{{ halaman.judul }}" required>
                        <div class="val-error judul text-danger fs-7 mt-1"></div>
                    </div>
                    <div class="mb-5">
                        <label class="form-label fw-semibold required">Slug (URL)</label>
                        <div class="input-group">
                            <span class="input-group-text text-muted">/halaman/</span>
                            <input type="text" class="form-control" name="slug" id="slugHalaman" value="{{ halaman.slug }}" placeholder="isi-manual-slug-unik" required>
                        </div>
                        <div class="form-text text-muted">Diisi manual. Tidak bisa diubah setelah dipublish (akan merusak link).</div>
                        <div class="val-error slug text-danger fs-7 mt-1"></div>
                    </div>
                    <div class="mb-5">
                        <label class="form-label fw-semibold required">Isi Halaman</label>
                        <textarea class="form-control tinymce-editor" name="isi" rows="15">{{ halaman.isi }}</textarea>
                        <div class="val-error isi text-danger fs-7 mt-1"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-4">
            <div class="card mb-5">
                <div class="card-header border-0 pt-5"><h3 class="card-title fw-bold fs-5">SEO</h3></div>
                <div class="card-body pt-3">
                    <div class="mb-4">
                        <label class="form-label fw-semibold">Meta Title <small class="text-muted" id="titleCount">(0/70)</small></label>
                        <input type="text" class="form-control" name="meta_title" id="metaTitle" value="{{ halaman.meta_title }}" maxlength="70">
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-semibold">Meta Description <small class="text-muted" id="descCount">(0/160)</small></label>
                        <textarea class="form-control" name="meta_description" id="metaDesc" rows="3" maxlength="160">{{ halaman.meta_description }}</textarea>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body pt-5">
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-secondary flex-fill" id="btnDraft">
                            <i class="ki-outline ki-save-2 fs-4"></i> Simpan Draft
                        </button>
                        <button type="button" class="btn btn-success flex-fill" id="btnPublish">
                            <i class="ki-outline ki-send fs-4"></i> Publish
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</form>

<script>
var $form = $('#halamanForm');
$('#metaTitle').on('input', function () { $('#titleCount').text('(' + $(this).val().length + '/70)'); }).trigger('input');
$('#metaDesc').on('input', function () { $('#descCount').text('(' + $(this).val().length + '/160)'); }).trigger('input');

$('#btnDraft').on('click', function () {
    $form.append('<input type="hidden" name="action" value="draft">');
    ajaxSubmit($form, '/redaksi/halaman/create', '/redaksi/halaman');
});
$('#btnPublish').on('click', function () {
    if (!confirm('Publish halaman ini ke situs publik?')) return;
    $form.append('<input type="hidden" name="action" value="publish">');
    ajaxSubmit($form, '/redaksi/halaman/create', '/redaksi/halaman');
});
</script>
{% endblock %}
```

- [ ] **Step 6: Commit**

```bash
git add backend/pages/redaksi/Halaman/
git commit -m "feat: implementasi modul Halaman (publish/unpublish + Go Edge + views)"
```

---

## Task 4: Modul Pengumuman — Controller + Views

**Files:**
- Modify: `backend/pages/redaksi/Pengumuman/Controllers/Pengumuman.php`
- Modify: `backend/pages/redaksi/Pengumuman/Models/ValPengumuman.php`
- Modify: `backend/pages/redaksi/Pengumuman/Views/index.html`
- Modify: `backend/pages/redaksi/Pengumuman/Views/form.html`
- Modify: `backend/pages/redaksi/Pengumuman/Config/Routes.php`

- [ ] **Step 1: Update ValPengumuman**

```php
<?php

namespace Redaksi\Pengumuman\Models;

use Base\Models\BaseModel;

class ValPengumuman extends BaseModel
{
    protected $table  = 'cms_pengumuman';
    protected $fields = [
        'tenant_id'       => '`rules=permit_empty|is_natural_no_zero`',
        'judul'           => '`rules=required|string|max_length[255]`',
        'slug'            => '`rules=permit_empty|string|max_length[200]`',
        'ringkasan'       => '`rules=permit_empty|string`',
        'status'          => '`rules=permit_empty|in_list[draft,terbit]`',
        'tanggal_mulai'   => '`rules=permit_empty|string` `form=date`',
        'tanggal_selesai' => '`rules=permit_empty|string` `form=date`',
        'tanggal_terbit'  => '`rules=permit_empty|string`',
    ];
}
```

- [ ] **Step 2: Update Routes.php Pengumuman**

```php
<?php

$routes->group('redaksi/pengumuman', ['namespace' => 'Redaksi\Pengumuman\Controllers'], static function ($routes) {
    $routes->get('/',          'Pengumuman::index');
    $routes->get('json-data',  'Pengumuman::jsonData');
    $routes->get('create',     'Pengumuman::create');
    $routes->post('create',    'Pengumuman::store');
    $routes->post('publish',   'Pengumuman::publish');
    $routes->post('unpublish', 'Pengumuman::unpublish');
    $routes->get('delete',     'Pengumuman::delete');
});
```

- [ ] **Step 3: Update controller Pengumuman.php**

```php
<?php

namespace Redaksi\Pengumuman\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\Datatable;
use Base\Libraries\GoEdge;
use Base\Libraries\Permission;
use Config\Database;
use Redaksi\Pengumuman\Models\ValPengumuman;

class Pengumuman extends BaseController
{
    public function index()
    {
        Permission::can('redaksi.pengumuman.read');
        return twig()->render('index');
    }

    public function jsonData()
    {
        Permission::can('redaksi.pengumuman.read');

        $tenantId = (int) tenant_id();
        $dt       = new Datatable();
        $dt->useKey(true);
        $dt->setQuery(
            "SELECT id, judul, slug, status, tanggal_mulai, tanggal_selesai
             FROM cms_pengumuman
             WHERE deleted_at IS NULL AND tenant_id = {$tenantId}
             __and_where__ GROUP BY id __order__ __limit_offset__"
        );
        $dt->setColumn([
            'id(d)'            => static fn ($row) => encrypt($row->id),
            'judul(ds)',
            'slug(ds)',
            'status(ds)',
            'tanggal_mulai(ds)',
            'tanggal_selesai(ds)',
        ]);

        return $dt->getJson();
    }

    public function create()
    {
        Permission::can('redaksi.pengumuman.upsert');

        $tenantId   = (int) tenant_id();
        $pengumuman = null;
        $id         = get('id');

        if ($id) {
            $pengumuman = (new ValPengumuman())->where('tenant_id', $tenantId)->find(decrypt($id));
        }

        return twig()->render('form', ['pengumuman' => $pengumuman]);
    }

    public function store()
    {
        Permission::can('redaksi.pengumuman.upsert');

        $validation = service('validation');
        $model      = new ValPengumuman();

        if (! $validation->valid($model)) {
            return $validation->errors();
        }

        $validated            = $validation->validated();
        $tenantId             = (int) tenant_id();
        $validated['tenant_id'] = $tenantId;

        // Validasi tanggal_selesai >= tanggal_mulai
        if (! empty($validated['tanggal_selesai']) && ! empty($validated['tanggal_mulai'])) {
            if ($validated['tanggal_selesai'] < $validated['tanggal_mulai']) {
                return jsonErrors(['tanggal_selesai' => 'Tanggal selesai harus sama dengan atau setelah tanggal mulai']);
            }
        }

        if (empty($validated['slug'])) {
            $validated['slug'] = makeSlug($validated['judul']);
        }

        $action = $this->request->getPost('action');
        if ($action === 'publish') {
            $validated['status']        = 'terbit';
            $validated['tanggal_terbit'] = date('Y-m-d');
        } else {
            $validated['status'] = 'draft';
        }

        $model->upsert($validated);

        if ($validated['status'] === 'terbit') {
            $this->triggerRebuild($tenantId);
        }

        return $validation->success('/redaksi/pengumuman');
    }

    public function publish()
    {
        Permission::can('redaksi.pengumuman.upsert');

        $id         = decrypt($this->request->getPost('id'));
        $tenantId   = (int) tenant_id();
        $pengumuman = (new ValPengumuman())->where('tenant_id', $tenantId)->find($id);

        if (! $pengumuman) {
            return jsonErrors(['id' => 'Pengumuman tidak ditemukan']);
        }

        Database::connect()->table('cms_pengumuman')->update([
            'status'         => 'terbit',
            'tanggal_terbit' => date('Y-m-d'),
            'modified_at'    => date('Y-m-d H:i:s'),
            'modified_by'    => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        $this->triggerRebuild($tenantId);

        return jsonSuccess('Pengumuman berhasil dipublish');
    }

    public function unpublish()
    {
        Permission::can('redaksi.pengumuman.upsert');

        $id       = decrypt($this->request->getPost('id'));
        $tenantId = (int) tenant_id();

        Database::connect()->table('cms_pengumuman')->update([
            'status'      => 'draft',
            'modified_at' => date('Y-m-d H:i:s'),
            'modified_by' => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        $this->triggerRebuild($tenantId);

        return jsonSuccess('Pengumuman berhasil di-unpublish');
    }

    public function delete()
    {
        Permission::can('redaksi.pengumuman.delete');

        $tenantId = (int) tenant_id();
        $id       = decrypt(get('id'));

        Database::connect()->table('cms_pengumuman')->update([
            'deleted_at' => date('Y-m-d H:i:s'),
            'deleted_by' => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        $this->triggerRebuild($tenantId);

        return jsonSuccess('Pengumuman berhasil dihapus');
    }

    private function triggerRebuild(int $tenantId): void
    {
        $domain = $this->getDomainForTenant($tenantId);
        if (! $domain) {
            return;
        }

        $items = Database::connect()->table('cms_pengumuman')
            ->select('slug, judul, ringkasan, tanggal_mulai, tanggal_selesai, tanggal_terbit')
            ->where('tenant_id', $tenantId)
            ->where('status', 'terbit')
            ->where('deleted_at IS NULL')
            ->orderBy('tanggal_terbit', 'DESC')
            ->get()->getResult();

        $list = array_map(fn ($p) => [
            'slug'            => $p->slug,
            'judul'           => $p->judul,
            'ringkasan'       => $p->ringkasan ?? '',
            'tanggal_mulai'   => $p->tanggal_mulai ?? '',
            'tanggal_selesai' => $p->tanggal_selesai ?? '',
            'tanggal_terbit'  => $p->tanggal_terbit ?? '',
        ], $items);

        (new GoEdge())->publishContent($domain, [
            ['path' => 'pengumuman.json', 'content' => json_encode(['items' => $list, 'updated_at' => date('c')], JSON_UNESCAPED_UNICODE)],
        ]);
    }

    private function getDomainForTenant(int $tenantId): ?string
    {
        $row = Database::connect()->table('app_domains')
            ->select('host')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->where('status', 'aktif')
            ->get()->getRow();

        return $row ? $row->host : null;
    }
}
```

- [ ] **Step 4: Buat view index.html**

```twig
{% extends "base.html" %}
{% block title %}Pengumuman{% endblock %}
{% block page_title %}Pengumuman{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-gray-900">Pengumuman</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/pengumuman/create" class="btn btn-sm btn-primary">
    <i class="ki-outline ki-plus fs-4"></i> Tambah Pengumuman
</a>
{% endblock %}

{% block content %}
<div class="card">
    <div class="card-header border-0 pt-6">
        <div class="card-title"><span class="fw-bold fs-3">Data Pengumuman</span></div>
    </div>
    <div class="card-body pt-0">
        <table id="pengumumanTable" class="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
                <tr class="fw-bold text-muted">
                    <th class="min-w-50px">No.</th>
                    <th class="min-w-300px">Pengumuman</th>
                    <th class="min-w-100px text-end">Aksi</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<script>
$(document).ready(function () {
    var table = $('#pengumumanTable').DataTable({
        searchDelay: 500, pageLength: 25, serverSide: true,
        order: [[1, 'desc']],
        columnDefs: [{ targets: [0], orderable: false }],
        ajax: { url: '/redaksi/pengumuman/json-data' },
        columns: [
            { data: 'line', className: 'text-gray-600 fw-bold' },
            {
                data: null,
                render: function (d) {
                    var st = d.status === 'terbit' ? 'success' : 'warning';
                    var lbl = d.status === 'terbit' ? 'Terbit' : 'Draft';
                    var period = (d.tanggal_mulai || '-') + ' s/d ' + (d.tanggal_selesai || '∞');
                    return '<div class="d-flex flex-column">'
                        + '<span class="fw-bold mb-1">' + d.judul + ' <span class="badge badge-light-' + st + ' ms-1">' + lbl + '</span></span>'
                        + '<span class="text-muted fs-7">' + period + '</span>'
                        + '</div>';
                }
            },
            {
                data: null, className: 'text-end', orderable: false,
                render: function (d) {
                    var btns = '<a href="/redaksi/pengumuman/create?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"><i class="ki-outline ki-pencil fs-4"></i></a>';
                    if (d.status === 'draft') {
                        btns += '<button class="btn btn-icon btn-bg-light btn-active-color-success btn-sm btn-publish" data-id="' + d.id + '"><i class="ki-outline ki-send fs-4"></i></button>';
                    } else {
                        btns += '<button class="btn btn-icon btn-bg-light btn-active-color-warning btn-sm btn-unpublish" data-id="' + d.id + '"><i class="ki-outline ki-archive-tick fs-4"></i></button>';
                    }
                    btns += '<a href="/redaksi/pengumuman/delete?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm btn-delete"><i class="ki-outline ki-trash fs-4"></i></a>';
                    return '<div class="d-flex justify-content-end gap-2">' + btns + '</div>';
                }
            }
        ],
    });
    $(document).on('click', '.btn-delete', function (e) { ajaxDelete($(this), e, table); });
    $(document).on('click', '.btn-publish', function () {
        if (!confirm('Publish pengumuman ini?')) return;
        $.post('/redaksi/pengumuman/publish', { id: $(this).data('id') }, function (r) { if (r.status) table.ajax.reload(null, false); });
    });
    $(document).on('click', '.btn-unpublish', function () {
        if (!confirm('Tarik pengumuman ini?')) return;
        $.post('/redaksi/pengumuman/unpublish', { id: $(this).data('id') }, function (r) { if (r.status) table.ajax.reload(null, false); });
    });
});
</script>
{% endblock %}
```

- [ ] **Step 5: Buat view form.html**

```twig
{% extends "base.html" %}
{% block title %}{{ pengumuman ? 'Edit' : 'Tambah' }} Pengumuman{% endblock %}
{% block page_title %}{{ pengumuman ? 'Edit' : 'Tambah' }} Pengumuman{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-muted"><a href="/redaksi/pengumuman" class="text-muted text-hover-primary">Pengumuman</a></li>
<li class="breadcrumb-item text-gray-900">{{ pengumuman ? 'Edit' : 'Tambah' }}</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/pengumuman" class="btn btn-sm btn-secondary"><i class="ki-outline ki-arrow-left fs-4"></i> Kembali</a>
{% endblock %}

{% block content %}
<form id="pengumumanForm" method="POST">
    <input type="hidden" name="id" value="{{ pengumuman.id|encrypt }}">
    <div class="row g-5">
        <div class="col-xl-8">
            <div class="card">
                <div class="card-body pt-6">
                    <div class="mb-5">
                        <label class="form-label fw-semibold required">Judul</label>
                        <input type="text" class="form-control" name="judul" value="{{ pengumuman.judul }}" required>
                        <div class="val-error judul text-danger fs-7 mt-1"></div>
                    </div>
                    <div class="mb-5">
                        <label class="form-label fw-semibold">Ringkasan</label>
                        <textarea class="form-control" name="ringkasan" rows="4">{{ pengumuman.ringkasan }}</textarea>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-5">
                            <label class="form-label fw-semibold">Tanggal Mulai</label>
                            <input type="date" class="form-control" name="tanggal_mulai" value="{{ pengumuman.tanggal_mulai }}">
                            <div class="val-error tanggal_mulai text-danger fs-7 mt-1"></div>
                        </div>
                        <div class="col-md-6 mb-5">
                            <label class="form-label fw-semibold">Tanggal Selesai <small class="text-muted">(kosong = tidak ada batas)</small></label>
                            <input type="date" class="form-control" name="tanggal_selesai" value="{{ pengumuman.tanggal_selesai }}">
                            <div class="val-error tanggal_selesai text-danger fs-7 mt-1"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-xl-4">
            <div class="card">
                <div class="card-body pt-5">
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-secondary flex-fill" id="btnDraft"><i class="ki-outline ki-save-2 fs-4"></i> Draft</button>
                        <button type="button" class="btn btn-success flex-fill" id="btnPublish"><i class="ki-outline ki-send fs-4"></i> Publish</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</form>

<script>
var $form = $('#pengumumanForm');
$('#btnDraft').on('click', function () {
    $form.append('<input type="hidden" name="action" value="draft">');
    ajaxSubmit($form, '/redaksi/pengumuman/create', '/redaksi/pengumuman');
});
$('#btnPublish').on('click', function () {
    if (!confirm('Publish pengumuman ini?')) return;
    $form.append('<input type="hidden" name="action" value="publish">');
    ajaxSubmit($form, '/redaksi/pengumuman/create', '/redaksi/pengumuman');
});
</script>
{% endblock %}
```

- [ ] **Step 6: Commit**

```bash
git add backend/pages/redaksi/Pengumuman/
git commit -m "feat: implementasi modul Pengumuman (publish/unpublish + Go Edge + views)"
```

---

## Task 5: Modul Slider — Controller + Views

**Files:**
- Modify: `backend/pages/redaksi/Slider/Controllers/Slider.php`
- Modify: `backend/pages/redaksi/Slider/Models/ValSlider.php`
- Modify: `backend/pages/redaksi/Slider/Views/index.html`
- Modify: `backend/pages/redaksi/Slider/Views/form.html`
- Modify: `backend/pages/redaksi/Slider/Config/Routes.php`

- [ ] **Step 1: Update ValSlider**

```php
<?php

namespace Redaksi\Slider\Models;

use Base\Models\BaseModel;

class ValSlider extends BaseModel
{
    protected $table  = 'cms_slider';
    protected $fields = [
        'tenant_id' => '`rules=permit_empty|is_natural_no_zero`',
        'judul'     => '`rules=permit_empty|string|max_length[255]`',
        'gambar'    => '`rules=permit_empty|string|max_length[500]`',
        'link'      => '`rules=permit_empty|string|max_length[500]`',
        'urutan'    => '`rules=permit_empty|integer`',
        'aktif'     => '`rules=permit_empty|integer`',
    ];
}
```

- [ ] **Step 2: Update Routes.php Slider**

```php
<?php

$routes->group('redaksi/slider', ['namespace' => 'Redaksi\Slider\Controllers'], static function ($routes) {
    $routes->get('/',             'Slider::index');
    $routes->get('json-data',     'Slider::jsonData');
    $routes->get('create',        'Slider::create');
    $routes->post('create',       'Slider::store');
    $routes->post('toggle-aktif', 'Slider::toggleAktif');
    $routes->get('delete',        'Slider::delete');
});
```

- [ ] **Step 3: Update controller Slider.php**

```php
<?php

namespace Redaksi\Slider\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\Datatable;
use Base\Libraries\GoEdge;
use Base\Libraries\Permission;
use Config\Database;
use Redaksi\Slider\Models\ValSlider;

class Slider extends BaseController
{
    public function index()
    {
        Permission::can('redaksi.slider.read');
        return twig()->render('index');
    }

    public function jsonData()
    {
        Permission::can('redaksi.slider.read');

        $tenantId = (int) tenant_id();
        $dt       = new Datatable();
        $dt->useKey(true);
        $dt->setQuery(
            "SELECT id, judul, gambar, link, urutan, aktif
             FROM cms_slider
             WHERE deleted_at IS NULL AND tenant_id = {$tenantId}
             __and_where__ GROUP BY id __order__ __limit_offset__"
        );
        $dt->setColumn([
            'id(d)'     => static fn ($row) => encrypt($row->id),
            'judul(ds)',
            'gambar(ds)',
            'urutan(ds)',
            'aktif(d)',
        ]);

        return $dt->getJson();
    }

    public function create()
    {
        Permission::can('redaksi.slider.upsert');

        $tenantId = (int) tenant_id();
        $slider   = null;
        $id       = get('id');

        if ($id) {
            $slider = (new ValSlider())->where('tenant_id', $tenantId)->find(decrypt($id));
        }

        return twig()->render('form', ['slider' => $slider]);
    }

    public function store()
    {
        Permission::can('redaksi.slider.upsert');

        $validation = service('validation');
        $model      = new ValSlider();

        if (! $validation->valid($model)) {
            return $validation->errors();
        }

        $validated              = $validation->validated();
        $tenantId               = (int) tenant_id();
        $validated['tenant_id'] = $tenantId;

        // Upload gambar — wajib jika tambah baru
        $file = $this->request->getFile('gambar');
        if ($file && $file->isValid() && ! $file->hasMoved()) {
            $domain  = $this->getDomainForTenant($tenantId);
            $goEdge  = new GoEdge();
            $newPath = $domain ? $goEdge->uploadMedia($domain, 'slider', $file) : null;
            if ($newPath) {
                $validated['gambar'] = $newPath;
            }
        } else {
            $editId = $this->request->getPost('id');
            if (! $editId) {
                return jsonErrors(['gambar' => 'Gambar slider wajib diupload']);
            }
        }

        $validated['aktif'] = 1;
        $model->upsert($validated);
        $this->triggerRebuild($tenantId);

        return $validation->success('/redaksi/slider');
    }

    public function toggleAktif()
    {
        Permission::can('redaksi.slider.upsert');

        $id       = decrypt($this->request->getPost('id'));
        $tenantId = (int) tenant_id();
        $slider   = (new ValSlider())->where('tenant_id', $tenantId)->find($id);

        if (! $slider) {
            return jsonErrors(['id' => 'Slider tidak ditemukan']);
        }

        $aktifBaru = $slider->aktif ? 0 : 1;
        Database::connect()->table('cms_slider')->update(
            ['aktif' => $aktifBaru, 'modified_at' => date('Y-m-d H:i:s')],
            ['id' => $id, 'tenant_id' => $tenantId]
        );

        $this->triggerRebuild($tenantId);

        return jsonSuccess($aktifBaru ? 'Slider diaktifkan' : 'Slider dinonaktifkan');
    }

    public function delete()
    {
        Permission::can('redaksi.slider.delete');

        $tenantId = (int) tenant_id();
        $id       = decrypt(get('id'));

        Database::connect()->table('cms_slider')->update([
            'deleted_at' => date('Y-m-d H:i:s'),
            'deleted_by' => anggota('username'),
        ], ['id' => $id, 'tenant_id' => $tenantId]);

        $this->triggerRebuild($tenantId);

        return jsonSuccess('Slider berhasil dihapus');
    }

    private function triggerRebuild(int $tenantId): void
    {
        $domain = $this->getDomainForTenant($tenantId);
        if (! $domain) {
            return;
        }

        $items = Database::connect()->table('cms_slider')
            ->select('judul, gambar, link, urutan')
            ->where('tenant_id', $tenantId)
            ->where('aktif', 1)
            ->where('deleted_at IS NULL')
            ->orderBy('urutan', 'ASC')
            ->get()->getResult();

        $list = array_map(fn ($s) => [
            'judul'  => $s->judul ?? '',
            'gambar' => $s->gambar,
            'link'   => $s->link ?? '',
            'urutan' => (int) $s->urutan,
        ], $items);

        (new GoEdge())->publishContent($domain, [
            ['path' => 'slider.json', 'content' => json_encode(['items' => $list, 'updated_at' => date('c')], JSON_UNESCAPED_UNICODE)],
        ]);
    }

    private function getDomainForTenant(int $tenantId): ?string
    {
        $row = Database::connect()->table('app_domains')
            ->select('host')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->where('status', 'aktif')
            ->get()->getRow();

        return $row ? $row->host : null;
    }
}
```

- [ ] **Step 4: Buat view index.html**

```twig
{% extends "base.html" %}
{% block title %}Slider{% endblock %}
{% block page_title %}Slider{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-gray-900">Slider</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/slider/create" class="btn btn-sm btn-primary">
    <i class="ki-outline ki-plus fs-4"></i> Tambah Slider
</a>
{% endblock %}

{% block content %}
<div class="card">
    <div class="card-body pt-6">
        <table id="sliderTable" class="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
                <tr class="fw-bold text-muted">
                    <th class="min-w-50px">No.</th>
                    <th class="min-w-80px">Gambar</th>
                    <th class="min-w-200px">Judul / Link</th>
                    <th class="min-w-60px">Urutan</th>
                    <th class="min-w-80px">Aktif</th>
                    <th class="min-w-100px text-end">Aksi</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<script>
$(document).ready(function () {
    var table = $('#sliderTable').DataTable({
        searchDelay: 500, pageLength: 25, serverSide: true,
        order: [[3, 'asc']],
        columnDefs: [{ targets: [0], orderable: false }],
        ajax: { url: '/redaksi/slider/json-data' },
        columns: [
            { data: 'line', className: 'text-gray-600 fw-bold' },
            {
                data: 'gambar', orderable: false,
                render: function (d) {
                    return d ? '<img src="' + d + '" height="50" style="object-fit:cover;border-radius:4px;">' : '-';
                }
            },
            {
                data: null,
                render: function (d) {
                    return '<div class="fw-semibold">' + (d.judul || '-') + '</div>'
                        + '<div class="text-muted fs-7">' + (d.link || '') + '</div>';
                }
            },
            { data: 'urutan' },
            {
                data: null, orderable: false,
                render: function (d) {
                    var cls = d.aktif ? 'success' : 'secondary';
                    var lbl = d.aktif ? 'Aktif' : 'Nonaktif';
                    return '<button class="btn btn-sm btn-light-' + cls + ' btn-toggle-aktif" data-id="' + d.id + '">' + lbl + '</button>';
                }
            },
            {
                data: null, className: 'text-end', orderable: false,
                render: function (d) {
                    return '<div class="d-flex justify-content-end gap-2">'
                        + '<a href="/redaksi/slider/create?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"><i class="ki-outline ki-pencil fs-4"></i></a>'
                        + '<a href="/redaksi/slider/delete?id=' + d.id + '" class="btn btn-icon btn-bg-light btn-active-color-danger btn-sm btn-delete"><i class="ki-outline ki-trash fs-4"></i></a>'
                        + '</div>';
                }
            }
        ],
    });
    $(document).on('click', '.btn-delete', function (e) { ajaxDelete($(this), e, table); });
    $(document).on('click', '.btn-toggle-aktif', function () {
        $.post('/redaksi/slider/toggle-aktif', { id: $(this).data('id') }, function (r) {
            if (r.status) table.ajax.reload(null, false);
        });
    });
});
</script>
{% endblock %}
```

- [ ] **Step 5: Buat view form.html**

```twig
{% extends "base.html" %}
{% block title %}{{ slider ? 'Edit' : 'Tambah' }} Slider{% endblock %}
{% block page_title %}{{ slider ? 'Edit' : 'Tambah' }} Slider{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-muted"><a href="/redaksi/slider" class="text-muted text-hover-primary">Slider</a></li>
<li class="breadcrumb-item text-gray-900">{{ slider ? 'Edit' : 'Tambah' }}</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/slider" class="btn btn-sm btn-secondary"><i class="ki-outline ki-arrow-left fs-4"></i> Kembali</a>
{% endblock %}

{% block content %}
<div class="card mw-600px mx-auto">
    <div class="card-body pt-6">
        <form id="sliderForm" enctype="multipart/form-data">
            <input type="hidden" name="id" value="{{ slider.id|encrypt }}">
            <div class="mb-5">
                <label class="form-label fw-semibold {{ not slider ? 'required' : '' }}">Gambar Slider</label>
                {% if slider.gambar %}
                    <div class="mb-2"><img src="{{ slider.gambar }}" height="80" style="border-radius:4px;"></div>
                {% endif %}
                <input type="file" class="form-control" name="gambar" accept="image/*" {{ not slider ? 'required' : '' }}>
                <div class="form-text text-muted">Rekomendasi: 1200×450px, JPG/PNG. Kosongkan untuk tidak ubah gambar.</div>
                <div class="val-error gambar text-danger fs-7 mt-1"></div>
            </div>
            <div class="mb-5">
                <label class="form-label fw-semibold">Judul (opsional)</label>
                <input type="text" class="form-control" name="judul" value="{{ slider.judul }}">
            </div>
            <div class="mb-5">
                <label class="form-label fw-semibold">Link Tujuan (opsional)</label>
                <input type="text" class="form-control" name="link" value="{{ slider.link }}" placeholder="https://... atau /berita/slug">
            </div>
            <div class="mb-5">
                <label class="form-label fw-semibold">Urutan</label>
                <input type="number" class="form-control" name="urutan" value="{{ slider.urutan ?: 0 }}">
                <div class="form-text text-muted">Angka lebih kecil tampil lebih awal.</div>
            </div>
            <div class="text-end">
                <button type="button" class="btn btn-primary" id="btnSimpan">Simpan</button>
            </div>
        </form>
    </div>
</div>

<script>
$('#btnSimpan').on('click', function () {
    ajaxSubmit($('#sliderForm'), '/redaksi/slider/create', '/redaksi/slider');
});
</script>
{% endblock %}
```

- [ ] **Step 6: Commit**

```bash
git add backend/pages/redaksi/Slider/
git commit -m "feat: implementasi modul Slider (toggle aktif + Go Edge push + views)"
```

---

## Task 6: Modul SEO — Controller + Views

**Files:**
- Modify: `backend/pages/redaksi/Seo/Controllers/Seo.php`
- Create: `backend/pages/redaksi/Seo/Models/ValSeo.php`
- Modify: `backend/pages/redaksi/Seo/Views/index.html`
- Create: `backend/pages/redaksi/Seo/Views/form.html`
- Modify: `backend/pages/redaksi/Seo/Config/Routes.php`

- [ ] **Step 1: Buat ValSeo.php**

```php
<?php

namespace Redaksi\Seo\Models;

use Base\Models\BaseModel;

class ValSeo extends BaseModel
{
    protected $table  = 'cms_berita'; // digunakan sebagai base, tipe diset di controller
    protected $fields = [
        'meta_title'       => '`rules=permit_empty|string|max_length[200]`',
        'meta_description' => '`rules=permit_empty|string|max_length[500]`',
        'og_image'         => '`rules=permit_empty|string|max_length[500]`',
    ];
}
```

- [ ] **Step 2: Update Routes.php SEO**

```php
<?php

$routes->group('redaksi/seo', ['namespace' => 'Redaksi\Seo\Controllers'], static function ($routes) {
    $routes->get('/',       'Seo::index');
    $routes->get('edit',    'Seo::edit');
    $routes->post('simpan', 'Seo::simpan');
});
```

- [ ] **Step 3: Update controller Seo.php**

```php
<?php

namespace Redaksi\Seo\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\GoEdge;
use Base\Libraries\Permission;
use Config\Database;

class Seo extends BaseController
{
    public function index()
    {
        Permission::can('redaksi.seo.read');

        $tenantId = (int) tenant_id();
        $db       = Database::connect();

        $berita = $db->table('cms_berita')
            ->select('id, judul, slug, meta_title, meta_description, og_image')
            ->where('tenant_id', $tenantId)
            ->where('status', 'terbit')
            ->where('deleted_at IS NULL')
            ->orderBy('judul', 'ASC')
            ->get()->getResult();

        $halaman = $db->table('cms_halaman')
            ->select('id, judul, slug, meta_title, meta_description, og_image')
            ->where('tenant_id', $tenantId)
            ->where('status', 'terbit')
            ->where('deleted_at IS NULL')
            ->orderBy('judul', 'ASC')
            ->get()->getResult();

        // Encrypt id untuk setiap item
        foreach ($berita  as $b) { $b->enc_id = encrypt($b->id); }
        foreach ($halaman as $h) { $h->enc_id = encrypt($h->id); }

        return twig()->render('index', ['berita' => $berita, 'halaman' => $halaman]);
    }

    public function edit()
    {
        Permission::can('redaksi.seo.read');

        $tenantId = (int) tenant_id();
        $tipe     = get('tipe', 'berita'); // 'berita' atau 'halaman'
        $id       = decrypt(get('id'));
        $tabel    = $tipe === 'halaman' ? 'cms_halaman' : 'cms_berita';

        $item = Database::connect()->table($tabel)
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->where('deleted_at IS NULL')
            ->get()->getRow();

        if (! $item) {
            return redirect()->to('/redaksi/seo');
        }

        return twig()->render('form', ['item' => $item, 'tipe' => $tipe]);
    }

    public function simpan()
    {
        Permission::can('redaksi.seo.upsert');

        $tenantId = (int) tenant_id();
        $tipe     = $this->request->getPost('tipe');
        $id       = decrypt($this->request->getPost('id'));
        $tabel    = $tipe === 'halaman' ? 'cms_halaman' : 'cms_berita';

        $db   = Database::connect();
        $item = $db->table($tabel)
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->get()->getRow();

        if (! $item) {
            return jsonErrors(['id' => 'Konten tidak ditemukan']);
        }

        $meta = [
            'meta_title'       => trim($this->request->getPost('meta_title') ?? ''),
            'meta_description' => trim($this->request->getPost('meta_description') ?? ''),
            'og_image'         => trim($this->request->getPost('og_image') ?? ''),
            'modified_at'      => date('Y-m-d H:i:s'),
        ];

        $db->table($tabel)->update($meta, ['id' => $id, 'tenant_id' => $tenantId]);

        // Re-push JSON konten agar meta terupdate di Go Edge
        $this->repushMeta($tipe, $item, $meta, $tenantId);

        return jsonSuccess('Meta SEO berhasil disimpan');
    }

    private function repushMeta(string $tipe, $item, array $meta, int $tenantId): void
    {
        $domain = $this->getDomainForTenant($tenantId);
        if (! $domain) {
            return;
        }

        if ($tipe === 'berita') {
            $detail = [
                'slug'             => $item->slug,
                'judul'            => $item->judul,
                'ringkasan'        => $item->ringkasan ?? '',
                'isi'              => $item->isi ?? '',
                'thumbnail'        => $item->thumbnail ?? '',
                'kategori'         => $item->kategori ?? '',
                'penulis'          => $item->penulis ?? '',
                'tanggal_terbit'   => $item->tanggal_terbit ?? '',
                'meta_title'       => $meta['meta_title'],
                'meta_description' => $meta['meta_description'],
                'og_image'         => $meta['og_image'],
            ];
            (new GoEdge())->publishContent($domain, [
                ['path' => 'berita/' . $item->slug . '.json', 'content' => json_encode($detail, JSON_UNESCAPED_UNICODE)],
            ]);
        } elseif ($tipe === 'halaman') {
            $detail = [
                'slug'             => $item->slug,
                'judul'            => $item->judul,
                'isi'              => $item->isi ?? '',
                'tanggal_terbit'   => $item->tanggal_terbit ?? '',
                'meta_title'       => $meta['meta_title'],
                'meta_description' => $meta['meta_description'],
                'og_image'         => $meta['og_image'],
            ];
            (new GoEdge())->publishContent($domain, [
                ['path' => 'halaman/' . $item->slug . '.json', 'content' => json_encode($detail, JSON_UNESCAPED_UNICODE)],
            ]);
        }
    }

    private function getDomainForTenant(int $tenantId): ?string
    {
        $row = Database::connect()->table('app_domains')
            ->select('host')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->where('status', 'aktif')
            ->get()->getRow();

        return $row ? $row->host : null;
    }
}
```

- [ ] **Step 4: Buat view index.html**

```twig
{% extends "base.html" %}
{% block title %}SEO{% endblock %}
{% block page_title %}SEO — Meta & OpenGraph{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-gray-900">SEO</li>
{% endblock %}

{% block content %}
{# Tab Berita #}
<div class="card mb-5">
    <div class="card-header border-0 pt-5">
        <h3 class="card-title fw-bold fs-5">Berita Terbit</h3>
    </div>
    <div class="card-body pt-0">
        <table class="table table-row-dashed align-middle gs-0 gy-3">
            <thead>
                <tr class="fw-bold text-muted">
                    <th>Judul</th>
                    <th>Meta Title</th>
                    <th>Meta Description</th>
                    <th class="text-end">Aksi</th>
                </tr>
            </thead>
            <tbody>
                {% for b in berita %}
                <tr>
                    <td><div class="fw-semibold">{{ b.judul }}</div><div class="text-muted fs-7">/berita/{{ b.slug }}</div></td>
                    <td><span class="fs-7 {{ b.meta_title ? 'text-gray-800' : 'text-muted' }}">{{ b.meta_title ?: '-' }}</span></td>
                    <td><span class="fs-7 {{ b.meta_description ? 'text-gray-800' : 'text-muted' }}">{{ b.meta_description|length > 50 ? b.meta_description|slice(0, 50) ~ '...' : (b.meta_description ?: '-') }}</span></td>
                    <td class="text-end">
                        <a href="/redaksi/seo/edit?tipe=berita&id={{ b.enc_id }}" class="btn btn-sm btn-light-primary">Edit Meta</a>
                    </td>
                </tr>
                {% else %}
                <tr><td colspan="4" class="text-muted text-center">Belum ada berita terbit</td></tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>

{# Tab Halaman #}
<div class="card">
    <div class="card-header border-0 pt-5">
        <h3 class="card-title fw-bold fs-5">Halaman Statis Terbit</h3>
    </div>
    <div class="card-body pt-0">
        <table class="table table-row-dashed align-middle gs-0 gy-3">
            <thead>
                <tr class="fw-bold text-muted">
                    <th>Judul</th>
                    <th>Meta Title</th>
                    <th>Meta Description</th>
                    <th class="text-end">Aksi</th>
                </tr>
            </thead>
            <tbody>
                {% for h in halaman %}
                <tr>
                    <td><div class="fw-semibold">{{ h.judul }}</div><div class="text-muted fs-7">/halaman/{{ h.slug }}</div></td>
                    <td><span class="fs-7 {{ h.meta_title ? 'text-gray-800' : 'text-muted' }}">{{ h.meta_title ?: '-' }}</span></td>
                    <td><span class="fs-7">{{ h.meta_description|length > 50 ? h.meta_description|slice(0, 50) ~ '...' : (h.meta_description ?: '-') }}</span></td>
                    <td class="text-end">
                        <a href="/redaksi/seo/edit?tipe=halaman&id={{ h.enc_id }}" class="btn btn-sm btn-light-primary">Edit Meta</a>
                    </td>
                </tr>
                {% else %}
                <tr><td colspan="4" class="text-muted text-center">Belum ada halaman terbit</td></tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 5: Buat view form.html**

```twig
{% extends "base.html" %}
{% block title %}Edit Meta SEO{% endblock %}
{% block page_title %}Edit Meta SEO{% endblock %}

{% block breadcrumb %}
<li class="breadcrumb-item"><span class="bullet bg-gray-500 w-5px h-2px"></span></li>
<li class="breadcrumb-item text-muted"><a href="/redaksi/seo" class="text-muted text-hover-primary">SEO</a></li>
<li class="breadcrumb-item text-gray-900">Edit Meta</li>
{% endblock %}

{% block toolbar %}
<a href="/redaksi/seo" class="btn btn-sm btn-secondary"><i class="ki-outline ki-arrow-left fs-4"></i> Kembali</a>
{% endblock %}

{% block content %}
<div class="card mw-700px mx-auto">
    <div class="card-body pt-6">
        <div class="mb-5 p-4 bg-light rounded">
            <div class="fw-bold">{{ item.judul }}</div>
            <div class="text-muted fs-7">/{{ tipe }}/{{ item.slug }}</div>
        </div>

        <form id="seoForm">
            <input type="hidden" name="id" value="{{ item.id|encrypt }}">
            <input type="hidden" name="tipe" value="{{ tipe }}">

            <div class="mb-5">
                <label class="form-label fw-semibold">Meta Title <span class="text-muted fs-7" id="titleCount">({{ item.meta_title|length }}/70)</span></label>
                <input type="text" class="form-control" name="meta_title" id="metaTitle" value="{{ item.meta_title }}" maxlength="70">
                <div class="form-text text-muted">Rekomendasi: 50–70 karakter. Muncul di tab browser dan hasil Google.</div>
            </div>

            <div class="mb-5">
                <label class="form-label fw-semibold">Meta Description <span class="text-muted fs-7" id="descCount">({{ item.meta_description|length }}/160)</span></label>
                <textarea class="form-control" name="meta_description" id="metaDesc" rows="3" maxlength="160">{{ item.meta_description }}</textarea>
                <div class="form-text text-muted">Rekomendasi: 120–160 karakter. Muncul sebagai ringkasan di hasil Google.</div>
            </div>

            <div class="mb-5">
                <label class="form-label fw-semibold">OG Image URL (opsional)</label>
                <input type="text" class="form-control" name="og_image" value="{{ item.og_image }}" placeholder="URL gambar untuk share sosial media">
            </div>

            <div class="text-end">
                <button type="button" class="btn btn-primary" id="btnSimpan">Simpan Meta</button>
            </div>
        </form>
    </div>
</div>

<script>
$('#metaTitle').on('input', function () { $('#titleCount').text('(' + $(this).val().length + '/70)'); });
$('#metaDesc').on('input', function () { $('#descCount').text('(' + $(this).val().length + '/160)'); });
$('#btnSimpan').on('click', function () {
    ajaxSubmit($('#seoForm'), '/redaksi/seo/simpan', '/redaksi/seo');
});
</script>
{% endblock %}
```

- [ ] **Step 6: Commit**

```bash
git add backend/pages/redaksi/Seo/
git commit -m "feat: implementasi modul SEO (edit meta per konten + re-push ke Go Edge)"
```

---

## Self-Review

**Spec coverage:**
- [x] §2 Kategori — tenant filter, relasi check → Task 2
- [x] §3 Halaman — publish/unpublish, slug manual, tenant filter → Task 3
- [x] §4 Pengumuman — publish/unpublish, validasi tanggal → Task 4
- [x] §5 Slider — toggleAktif, upload gambar required saat baru, push slider.json → Task 5
- [x] §6 SEO — edit meta, re-push JSON → Task 6
- [x] §7 DB fields → Task 1 (02_cms_tables.sql)
- [x] §8 JSON schemas → implemented di triggerPublish/triggerRebuild setiap controller

**Gap yang diperbaiki:**
- Semua `getDomainForTenant()` menggunakan query yang sama — ini duplikasi di 4 controller. Untuk MVP diterima, tapi saat refactor nanti bisa dipindah ke helper. Tidak diubah sekarang (YAGNI).
- `ValSeo.php` dibuat sederhana karena update langsung via `Database::connect()` di controller, tidak melalui model. `$table` di ValSeo tidak dipakai — ini OK karena model hanya digunakan untuk definisi field jika sewaktu-waktu diperlukan.
- `cms_berita` diasumsikan sudah punya kolom `meta_title`, `meta_description`, `og_image` setelah ALTER TABLE di Task 1.
