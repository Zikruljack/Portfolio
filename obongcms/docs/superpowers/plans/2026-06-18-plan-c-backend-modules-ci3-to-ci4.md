# Plan C: CI4 Backend — Port Modul CI3 → CI4 (Panel + Redaksi)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port semua modul dari acehcms-v5 CI3 (panel manage + redaksi) ke ObongCMS CI4, dengan konvensi CI4, Twig views, dan gRPC publish. Semua modul ObongCMS yang sudah ada di-overwrite.

**Architecture:** Setiap modul di `pages/panel/` dan `pages/redaksi/` mengikuti struktur `Controllers/`, `Models/`, `Views/`, `Config/Routes.php`. Controller extend `BaseController`, model extend `BaseModel`, views pakai Twig. Permission check di setiap method. Tenant isolation wajib di semua query redaksi.

**Tech Stack:** PHP 8.4, CodeIgniter 4.7+, Twig 3, MySQL (QueryBuilder CI4)

## Global Constraints

- Setiap controller method WAJIB: `Permission::can('kategori.modul.aksi')` di baris pertama
- Semua query modul redaksi WAJIB: `->where('tenant_id', session()->get('tenant_id'))`
- ID di URL WAJIB: `encrypt()` pada output, `decrypt()` pada input
- Validasi pakai class `ValNamaModul` dengan field DSL (lihat `docs/ci4_conventions.md`)
- Model pakai `upsert()` untuk insert/update, `delete()` untuk soft delete
- Views: Twig `.html` — tidak ada PHP view
- Response JSON: `{ "status": true, "message": "...", "data": {} }`
- Komentar kode & variabel lokal: Bahasa Indonesia
- CI3 `$this->load->model/library` → CI4 `new Model()/Library()` di constructor atau method
- CI3 `$this->db->query("... domain_id='".domain_id()."'")` → CI4 `->where('tenant_id', session()->get('tenant_id'))`
- Branding: `acehcms`/`acehprov` → `obongcms`/`obong`

---

## File Structure Overview

```
backend/pages/
├── panel/
│   ├── Auth/          ← sudah ada, overwrite
│   ├── Dashboard/     ← sudah ada, overwrite
│   ├── Wilayah/       ← sudah ada, port dari manage/superadmin
│   ├── Platform/      ← sudah ada, port dari manage/superadmin
│   ├── Tenant/        ← sudah ada, port dari manage/domain
│   ├── Domain/        ← sudah ada, port dari manage/domain
│   ├── User/          ← sudah ada, port dari manage/redaksi
│   ├── Pengaturan/    ← sudah ada, port
│   ├── Audit/         ← sudah ada, port dari manage/aktivitas
│   └── Api/           ← sudah ada, port
└── redaksi/
    ├── Auth/          ← BARU (port dari redaksi/secure)
    ├── Dashboard/     ← sudah ada, overwrite
    ├── Berita/        ← sudah ada, overwrite
    ├── Kategori/      ← sudah ada, overwrite
    ├── Halaman/       ← sudah ada, overwrite
    ├── Galeri/        ← sudah ada, overwrite
    ├── Pengumuman/    ← sudah ada, overwrite
    ├── Agenda/        ← sudah ada (dari plan sebelumnya), overwrite
    ├── Pejabat/       ← BARU (port dari redaksi/pejabat)
    ├── Komentar/      ← BARU (port dari redaksi/komentar)
    ├── Slider/        ← sudah ada, overwrite
    ├── Menu/          ← sudah ada, overwrite
    ├── Seo/           ← sudah ada, overwrite
    ├── Tampilan/      ← sudah ada (partial), overwrite
    ├── Media/         ← sudah ada (File), overwrite
    └── User/          ← sudah ada, overwrite
```

---

## Panduan Porting CI3 → CI4 (baca sebelum mulai setiap task)

### Controller
```php
// CI3
class Berita extends MY_Controller {
    public function index() {
        $this->Permission->can('manage_berita');
        $data = $this->Berita_model->get_all();
        $this->template->render('berita/index', $data);
    }
}

// CI4
class Berita extends BaseController {
    public function index(): string {
        Permission::can('redaksi.berita.baca');
        $model = new BeritaModel();
        $data  = $model->where('tenant_id', session()->get('tenant_id'))->findAll();
        return $this->view('Berita/Views/index.html', ['data' => $data]);
    }
}
```

### Model
```php
// CI3 model pakai $this->db->query() dengan string interpolasi → CI4 QueryBuilder

// CI3:
$this->db->query("SELECT * FROM berita WHERE domain_id='".domain_id()."' AND deleted=0");

// CI4:
$this->db->table('cms_berita')
    ->where('tenant_id', session()->get('tenant_id'))
    ->where('deleted', 0)
    ->get()->getResultArray();
```

### Validation
```php
// CI4 validation model pattern (field DSL):
class ValBerita {
    public string $judul    = '`rules=required|string|max_length[255]` `label=Judul`';
    public string $konten   = '`rules=required` `label=Konten`';
    public string $kategori = '`rules=required|is_natural_no_zero` `label=Kategori`';
}
```

---

## Task 1: Panel Auth — login, logout, OTP

**Source:** `backend_be/pages/manage/secure/` + `backend_be/codeigniter/application/controllers/Api.php`  
**Target:** `backend/pages/panel/Auth/`

**Files:**
- Modify: `backend/pages/panel/Auth/Controllers/Auth.php`
- Modify: `backend/pages/panel/Auth/Models/AuthModel.php`
- Create: `backend/pages/panel/Auth/Views/login.html`
- Create: `backend/pages/panel/Auth/Views/otp.html`
- Modify: `backend/pages/panel/Auth/Config/Routes.php`

- [ ] **Step 1: Baca source CI3 Auth**

```bash
find /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/manage/secure -type f | xargs ls -la
cat /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/manage/secure/controllers/*.php | head -100
```

- [ ] **Step 2: Tulis test (Playwright — ikuti `/test.md`)**

Test flow login:
1. Buka `http://panel.obongcms.local/panel/auth`
2. Isi email + password → submit
3. Expected: redirect ke OTP form
4. Isi OTP (6 digit) → submit
5. Expected: redirect ke dashboard

- [ ] **Step 3: Implement Auth controller CI4**

```php
// backend/pages/panel/Auth/Controllers/Auth.php
namespace Pages\Panel\Auth\Controllers;

use Base\Controllers\BaseController;
use Pages\Panel\Auth\Models\AuthModel;

class Auth extends BaseController
{
    private AuthModel $model;

    public function __construct()
    {
        $this->model = new AuthModel();
    }

    // Tampilkan form login
    public function index(): string
    {
        if (session()->get('user_id')) {
            return redirect()->to('/panel/dashboard');
        }
        return view('Pages\Panel\Auth\Views\login', []);
    }

    // Proses login: cek email+password, kirim OTP
    public function proses(): \CodeIgniter\HTTP\RedirectResponse
    {
        $email    = $this->request->getPost('email');
        $password = $this->request->getPost('password');
        $user     = $this->model->findByEmail($email);

        if (!$user || !password_verify($password, $user['password'])) {
            return redirect()->back()->with('error', 'Email atau password salah');
        }

        // Buat OTP 6 digit, simpan ke session/db, kirim email
        $otp = $this->model->generateOtp($user['id']);
        // Kirim OTP via email (gunakan Mailer library CI4)
        $this->model->sendOtpEmail($user['email'], $otp);

        session()->set('auth_pending_id', $user['id']);
        return redirect()->to('/panel/auth/otp');
    }

    // Tampilkan form OTP
    public function otp(): string
    {
        if (!session()->get('auth_pending_id')) {
            return redirect()->to('/panel/auth');
        }
        return view('Pages\Panel\Auth\Views\otp', []);
    }

    // Verifikasi OTP → set session lengkap
    public function verifyOtp(): \CodeIgniter\HTTP\RedirectResponse
    {
        $userId = session()->get('auth_pending_id');
        $kode   = $this->request->getPost('kode');

        if (!$userId || !$this->model->verifyOtp($userId, $kode)) {
            return redirect()->back()->with('error', 'OTP tidak valid atau sudah kadaluarsa');
        }

        $user = $this->model->find($userId);
        session()->set([
            'user_id'    => $user['id'],
            'user_nama'  => $user['nama'],
            'user_email' => $user['email'],
            'user_level' => $user['level_id'],
            'tenant_id'  => $user['tenant_id'] ?? null,
        ]);
        session()->remove('auth_pending_id');

        return redirect()->to('/panel/dashboard');
    }

    // Logout
    public function logout(): \CodeIgniter\HTTP\RedirectResponse
    {
        session()->destroy();
        return redirect()->to('/panel/auth');
    }
}
```

- [ ] **Step 4: Implement AuthModel**

```php
// backend/pages/panel/Auth/Models/AuthModel.php
namespace Pages\Panel\Auth\Models;

use Base\Models\BaseModel;

class AuthModel extends BaseModel
{
    protected $table      = 'app_users';
    protected $primaryKey = 'id';

    public function findByEmail(string $email): ?array
    {
        return $this->where('email', $email)->where('deleted', 0)->first();
    }

    // Buat OTP 6 digit, simpan ke app_otp dengan expiry 10 menit
    public function generateOtp(int $userId): string
    {
        $kode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $db   = db_connect();
        $db->table('app_otp')->where('user_id', $userId)->delete();
        $db->table('app_otp')->insert([
            'user_id'    => $userId,
            'kode'       => $kode,
            'expired_at' => date('Y-m-d H:i:s', strtotime('+10 minutes')),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        return $kode;
    }

    // Verifikasi OTP — return true jika valid dan belum expire
    public function verifyOtp(int $userId, string $kode): bool
    {
        $db  = db_connect();
        $otp = $db->table('app_otp')
            ->where('user_id', $userId)
            ->where('kode', $kode)
            ->where('expired_at >=', date('Y-m-d H:i:s'))
            ->get()->getRowArray();
        if ($otp) {
            $db->table('app_otp')->where('user_id', $userId)->delete();
            return true;
        }
        return false;
    }

    public function sendOtpEmail(string $email, string $kode): void
    {
        // Gunakan CI4 Email service
        $emailService = \Config\Services::email();
        $emailService->setTo($email);
        $emailService->setSubject('Kode OTP ObongCMS');
        $emailService->setMessage("Kode OTP Anda: <b>{$kode}</b><br>Berlaku 10 menit.");
        $emailService->send();
    }
}
```

- [ ] **Step 5: Buat Twig views untuk login dan OTP**

`backend/pages/panel/Auth/Views/login.html`:
```twig
{% extends "layout/auth.html" %}
{% block content %}
<form method="POST" action="/panel/auth/proses">
    {{ csrf_field() }}
    {% if flash.error is defined %}
        <div class="alert alert-danger">{{ flash.error }}</div>
    {% endif %}
    <div class="mb-3">
        <label>Email</label>
        <input type="email" name="email" class="form-control" required>
    </div>
    <div class="mb-3">
        <label>Password</label>
        <input type="password" name="password" class="form-control" required>
    </div>
    <button type="submit" class="btn btn-primary w-100">Masuk</button>
</form>
{% endblock %}
```

`backend/pages/panel/Auth/Views/otp.html`:
```twig
{% extends "layout/auth.html" %}
{% block content %}
<form method="POST" action="/panel/auth/verify-otp">
    {{ csrf_field() }}
    {% if flash.error is defined %}
        <div class="alert alert-danger">{{ flash.error }}</div>
    {% endif %}
    <div class="mb-3">
        <label>Kode OTP (6 digit, dikirim ke email)</label>
        <input type="text" name="kode" class="form-control" maxlength="6" required autofocus>
    </div>
    <button type="submit" class="btn btn-primary w-100">Verifikasi</button>
</form>
{% endblock %}
```

- [ ] **Step 6: Update Routes.php**

```php
// backend/pages/panel/Auth/Config/Routes.php
$routes->group('panel/auth', function ($routes) {
    $routes->get('/',            'Pages\Panel\Auth\Controllers\Auth::index');
    $routes->post('/proses',     'Pages\Panel\Auth\Controllers\Auth::proses');
    $routes->get('/otp',         'Pages\Panel\Auth\Controllers\Auth::otp');
    $routes->post('/verify-otp', 'Pages\Panel\Auth\Controllers\Auth::verifyOtp');
    $routes->get('/logout',      'Pages\Panel\Auth\Controllers\Auth::logout');
});
```

- [ ] **Step 7: Commit**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
git add pages/panel/Auth/
git commit -m "feat: panel Auth — login, OTP, logout (port dari acehcms manage/secure CI3→CI4)"
```

---

## Task 2: Panel Dashboard

**Source:** `backend_be/pages/manage/dashboard/`  
**Target:** `backend/pages/panel/Dashboard/`

- [ ] **Step 1: Baca source CI3**

```bash
cat /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/manage/dashboard/controllers/*.php
```

- [ ] **Step 2: Implement Dashboard controller CI4**

```php
// backend/pages/panel/Dashboard/Controllers/Dashboard.php
namespace Pages\Panel\Dashboard\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\Permission;

class Dashboard extends BaseController
{
    public function index(): string
    {
        Permission::can('panel.dashboard.baca');
        return $this->view('Pages\Panel\Dashboard\Views\index.html', [
            'judul' => 'Dashboard',
        ]);
    }
}
```

- [ ] **Step 3: Buat view index.html (Twig)**

```twig
{# backend/pages/panel/Dashboard/Views/index.html #}
{% extends "layout/panel.html" %}
{% block content %}
<div class="container-fluid">
    <h1 class="h3 mb-4">Dashboard ObongCMS</h1>
    <div class="row">
        <div class="col-12">
            <p>Selamat datang di panel admin ObongCMS.</p>
        </div>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 4: Commit**

```bash
git add pages/panel/Dashboard/
git commit -m "feat: panel Dashboard (port CI3→CI4)"
```

---

## Task 3: Panel Tenant + Domain

**Source:** `backend_be/pages/manage/domain/` + `backend_be/pages/manage/redaksi/`  
**Target:** `backend/pages/panel/Tenant/` + `backend/pages/panel/Domain/`

**Files:**
- Create/Modify: `pages/panel/Tenant/Controllers/Tenant.php`
- Create/Modify: `pages/panel/Tenant/Models/TenantModel.php`
- Create/Modify: `pages/panel/Tenant/Models/ValTenant.php`
- Create/Modify: `pages/panel/Tenant/Views/index.html`, `form.html`
- Create/Modify: `pages/panel/Tenant/Config/Routes.php`
- Sama untuk `Domain/`

- [ ] **Step 1: Baca source CI3**

```bash
cat /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/manage/domain/controllers/*.php | head -150
cat /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/manage/domain/models/*.php
```

- [ ] **Step 2: Implement TenantModel**

```php
// backend/pages/panel/Tenant/Models/TenantModel.php
namespace Pages\Panel\Tenant\Models;

use Base\Models\BaseModel;

class TenantModel extends BaseModel
{
    protected $table      = 'app_tenants';
    protected $primaryKey = 'id';

    // Ambil semua tenant dengan data domain aktif
    public function getAllWithDomain(): array
    {
        return $this->db->table('app_tenants t')
            ->join('app_domains d', 'd.tenant_id = t.id AND d.is_primary = 1', 'left')
            ->select('t.id, t.kode, t.nama, t.platform_id, d.domain, t.created_at')
            ->where('t.deleted', 0)
            ->orderBy('t.nama', 'ASC')
            ->get()->getResultArray();
    }
}
```

- [ ] **Step 3: Implement Tenant controller**

```php
// backend/pages/panel/Tenant/Controllers/Tenant.php
namespace Pages\Panel\Tenant\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\EdgeGrpc;
use Base\Libraries\Permission;
use Pages\Panel\Tenant\Models\TenantModel;
use Pages\Panel\Tenant\Models\ValTenant;

class Tenant extends BaseController
{
    private TenantModel $model;

    public function __construct()
    {
        $this->model = new TenantModel();
    }

    public function index(): string
    {
        Permission::can('panel.tenant.baca');
        return $this->view('Pages\Panel\Tenant\Views\index.html', [
            'judul' => 'Manajemen Tenant',
        ]);
    }

    // DataTable endpoint
    public function data(): \CodeIgniter\HTTP\ResponseInterface
    {
        Permission::can('panel.tenant.baca');
        $data = $this->model->getAllWithDomain();
        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function tambah(): string
    {
        Permission::can('panel.tenant.tambah');
        return $this->view('Pages\Panel\Tenant\Views\form.html', [
            'judul' => 'Tambah Tenant',
        ]);
    }

    public function simpan(): \CodeIgniter\HTTP\ResponseInterface
    {
        Permission::can('panel.tenant.tambah');
        $val = new ValTenant();
        if (!$this->validate((new \Base\Validation\Validation())->rules($val))) {
            return $this->response->setJSON(['status' => false, 'message' => $this->validator->getErrors()]);
        }

        $kode = $this->request->getPost('kode');
        $data = [
            'kode'        => $kode,
            'nama'        => $this->request->getPost('nama'),
            'platform_id' => $this->request->getPost('platform_id'),
            'created_at'  => date('Y-m-d H:i:s'),
        ];
        $this->model->upsert($data);

        // Kirim SyncDomainConfig ke Go Edge
        $domain     = $this->request->getPost('domain');
        $redaksiUrl = 'redaksi.' . $domain;
        $edge       = new EdgeGrpc();
        $edge->syncDomainConfig($kode, $domain, 'default', false, $redaksiUrl);

        return $this->response->setJSON(['status' => true, 'message' => 'Tenant berhasil ditambahkan']);
    }

    public function hapus(): \CodeIgniter\HTTP\ResponseInterface
    {
        Permission::can('panel.tenant.hapus');
        $id   = decrypt($this->request->getPost('id'));
        $this->model->delete($id);
        return $this->response->setJSON(['status' => true, 'message' => 'Tenant berhasil dihapus']);
    }
}
```

- [ ] **Step 4: Buat ValTenant**

```php
// backend/pages/panel/Tenant/Models/ValTenant.php
namespace Pages\Panel\Tenant\Models;

class ValTenant
{
    public string $kode      = '`rules=required|alpha_dash|max_length[50]` `label=Kode`';
    public string $nama      = '`rules=required|string|max_length[255]` `label=Nama`';
    public string $domain    = '`rules=required|valid_url_strict` `label=Domain`';
    public string $platform_id = '`rules=required|is_natural_no_zero` `label=Platform`';
}
```

- [ ] **Step 5: Buat Views (Twig)**

`index.html` — tabel DataTable dengan kolom: Nama, Kode, Domain, Aksi  
`form.html` — form input Kode, Nama, Platform, Domain

(Ikuti pattern dari `docs/module_index.md` dan contoh view yang sudah ada)

- [ ] **Step 6: Routes.php**

```php
$routes->group('panel/tenant', ['filter' => 'auth:panel'], function ($routes) {
    $routes->get('/',        'Pages\Panel\Tenant\Controllers\Tenant::index');
    $routes->get('/data',    'Pages\Panel\Tenant\Controllers\Tenant::data');
    $routes->get('/tambah',  'Pages\Panel\Tenant\Controllers\Tenant::tambah');
    $routes->post('/simpan', 'Pages\Panel\Tenant\Controllers\Tenant::simpan');
    $routes->post('/hapus',  'Pages\Panel\Tenant\Controllers\Tenant::hapus');
});
```

- [ ] **Step 7: Commit**

```bash
git add pages/panel/Tenant/ pages/panel/Domain/
git commit -m "feat: panel Tenant + Domain (port CI3→CI4, tambah EdgeGrpc::syncDomainConfig saat create)"
```

---

## Task 4: Panel User + Wilayah + Platform + Audit + Pengaturan + Api

**Source:** `manage/superadmin/`, `manage/redaksi/`, `manage/aktivitas/`  
**Target:** `panel/Wilayah/`, `panel/Platform/`, `panel/User/`, `panel/Audit/`, `panel/Pengaturan/`, `panel/Api/`

Pola yang sama untuk semua modul ini — baca source CI3, port ke CI4 dengan konvensi yang sama.

- [ ] **Step 1: Baca semua source CI3 yang relevan**

```bash
find /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/manage \
    -name "*.php" | xargs grep -l "class " | head -20
```

- [ ] **Step 2: Implement per modul** (ulangi pola Task 3 untuk setiap modul)

Untuk **Wilayah** (dari manage/superadmin — bagian wilayah):
- Table: `app_wilayah`
- Kolom: `id`, `nama`, `kode`, `level` (provinsi/kabupaten/kota), `parent_id`
- CRUD standard

Untuk **Platform** (dari manage/superadmin — bagian platform):
- Table: `app_platforms`
- Kolom: `id`, `nama`, `kode`, `domain_suffix`, `wilayah_id`
- CRUD standard

Untuk **User** (dari manage/redaksi):
- Table: `app_users` + `app_users_level`
- CRUD dengan assign role dan scope (wilayah/platform/tenant)

Untuk **Audit** (dari manage/aktivitas):
- Table: `app_activity`
- Read-only: list aktivitas dengan filter user, tanggal, aksi

Untuk **Pengaturan** (dari manage/superadmin — bagian settings):
- Table: `app_settings`
- Key-value editor

Untuk **Api** (endpoint publik untuk Go Edge):
- `GET /api/domain/{domain}` → return tenant config
- `GET /api/content/{domain}/{type}` → return content list

- [ ] **Step 3: Commit per modul**

```bash
# Contoh untuk Wilayah:
git add pages/panel/Wilayah/
git commit -m "feat: panel Wilayah (port CI3→CI4)"
# Ulangi untuk setiap modul
```

---

## Task 5: Redaksi Auth

**Source:** `backend_be/pages/redaksi/secure/`  
**Target:** `backend/pages/redaksi/Auth/`

Sama dengan panel Auth (Task 1) tapi untuk redaksi — session `tenant_id` harus di-set saat login berhasil, sesuai domain request.

- [ ] **Step 1: Buat structure**

```bash
mkdir -p /home/obong/Codes/project_codes/ObongCMS/backend/pages/redaksi/Auth/{Controllers,Models,Views,Config}
```

- [ ] **Step 2: Implement Redaksi Auth controller**

Perbedaan dari panel Auth:
- URL prefix: `/redaksi/auth`
- Setelah login, set `tenant_id` berdasarkan domain request (Nginx forward `X-Tenant-Code` header, atau resolve dari hostname)
- Redirect ke `/redaksi/dashboard` bukan `/panel/dashboard`

```php
// backend/pages/redaksi/Auth/Controllers/Auth.php
namespace Pages\Redaksi\Auth\Controllers;

use Base\Controllers\BaseController;
use Pages\Redaksi\Auth\Models\AuthModel;

class Auth extends BaseController
{
    private AuthModel $model;

    public function __construct()
    {
        $this->model = new AuthModel();
    }

    public function index(): string
    {
        if (session()->get('user_id')) {
            return redirect()->to('/redaksi/dashboard');
        }
        return $this->view('Pages\Redaksi\Auth\Views\login.html', []);
    }

    public function proses(): \CodeIgniter\HTTP\RedirectResponse
    {
        $email     = $this->request->getPost('email');
        $password  = $this->request->getPost('password');
        // Resolve tenant_id dari hostname redaksi.{domain}
        $tenantId  = $this->model->resolveTenantFromHost($this->request->getServer('HTTP_HOST'));

        $user = $this->model->findByEmailAndTenant($email, $tenantId);
        if (!$user || !password_verify($password, $user['password'])) {
            return redirect()->back()->with('error', 'Email atau password salah');
        }

        $otp = $this->model->generateOtp($user['id']);
        $this->model->sendOtpEmail($user['email'], $otp);
        session()->set(['auth_pending_id' => $user['id'], 'auth_tenant_id' => $tenantId]);
        return redirect()->to('/redaksi/auth/otp');
    }

    public function verifyOtp(): \CodeIgniter\HTTP\RedirectResponse
    {
        $userId   = session()->get('auth_pending_id');
        $tenantId = session()->get('auth_tenant_id');
        $kode     = $this->request->getPost('kode');

        if (!$userId || !$this->model->verifyOtp($userId, $kode)) {
            return redirect()->back()->with('error', 'OTP tidak valid atau sudah kadaluarsa');
        }

        $user = $this->model->find($userId);
        session()->set([
            'user_id'    => $user['id'],
            'user_nama'  => $user['nama'],
            'user_email' => $user['email'],
            'user_level' => $user['level_id'],
            'tenant_id'  => $tenantId,
        ]);
        session()->remove(['auth_pending_id', 'auth_tenant_id']);
        return redirect()->to('/redaksi/dashboard');
    }

    public function otp(): string
    {
        if (!session()->get('auth_pending_id')) {
            return redirect()->to('/redaksi/auth');
        }
        return $this->view('Pages\Redaksi\Auth\Views\otp.html', []);
    }

    public function logout(): \CodeIgniter\HTTP\RedirectResponse
    {
        session()->destroy();
        return redirect()->to('/redaksi/auth');
    }
}
```

- [ ] **Step 3: Routes.php**

```php
$routes->group('redaksi/auth', function ($routes) {
    $routes->get('/',            'Pages\Redaksi\Auth\Controllers\Auth::index');
    $routes->post('/proses',     'Pages\Redaksi\Auth\Controllers\Auth::proses');
    $routes->get('/otp',         'Pages\Redaksi\Auth\Controllers\Auth::otp');
    $routes->post('/verify-otp', 'Pages\Redaksi\Auth\Controllers\Auth::verifyOtp');
    $routes->get('/logout',      'Pages\Redaksi\Auth\Controllers\Auth::logout');
});
```

- [ ] **Step 4: Commit**

```bash
git add pages/redaksi/Auth/
git commit -m "feat: redaksi Auth — login + OTP + tenant resolver dari hostname"
```

---

## Task 6: Redaksi Berita (full CRUD + publish)

**Source:** `backend_be/pages/redaksi/berita/`  
**Target:** `backend/pages/redaksi/Berita/`

Ini modul terpenting — pola ini diulang untuk semua modul redaksi lainnya.

**Files:**
- Modify: `pages/redaksi/Berita/Controllers/Berita.php`
- Modify: `pages/redaksi/Berita/Models/ValBerita.php`
- Create: `pages/redaksi/Berita/Models/BeritaModel.php`
- Create: `pages/redaksi/Berita/Views/index.html`
- Create: `pages/redaksi/Berita/Views/form.html`
- Modify: `pages/redaksi/Berita/Config/Routes.php`

- [ ] **Step 1: Baca source CI3**

```bash
cat /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/redaksi/berita/controllers/Berita.php
cat /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/pages/redaksi/berita/models/Berita_model.php
```

- [ ] **Step 2: Implement BeritaModel**

```php
// backend/pages/redaksi/Berita/Models/BeritaModel.php
namespace Pages\Redaksi\Berita\Models;

use Base\Models\BaseModel;

class BeritaModel extends BaseModel
{
    protected $table      = 'cms_berita';
    protected $primaryKey = 'id';

    // Ambil daftar berita untuk tenant ini — WAJIB filter tenant_id
    public function getList(int $tenantId): array
    {
        return $this->db->table('cms_berita b')
            ->join('cms_kategori k', 'k.id = b.kategori_id', 'left')
            ->join('app_users u', 'u.id = b.created_by', 'left')
            ->select('b.id, b.judul, b.slug, b.status, k.nama as kategori, u.nama as penulis, b.tanggal, b.created_at')
            ->where('b.tenant_id', $tenantId)   // WAJIB
            ->where('b.deleted', 0)
            ->orderBy('b.created_at', 'DESC')
            ->get()->getResultArray();
    }

    // Ambil detail berita + kategori + tags
    public function getDetail(int $id, int $tenantId): ?array
    {
        $berita = $this->where('id', $id)->where('tenant_id', $tenantId)->where('deleted', 0)->first();
        if (!$berita) {
            return null;
        }
        // Tambah tags
        $berita['tags'] = $this->db->table('cms_berita_tag bt')
            ->join('cms_tag t', 't.id = bt.tag_id')
            ->select('t.id, t.nama')
            ->where('bt.berita_id', $id)
            ->get()->getResultArray();
        return $berita;
    }
}
```

- [ ] **Step 3: Implement Berita controller**

```php
// backend/pages/redaksi/Berita/Controllers/Berita.php
namespace Pages\Redaksi\Berita\Controllers;

use Base\Controllers\BaseController;
use Base\Libraries\EdgeGrpc;
use Base\Libraries\Generator;
use Base\Libraries\Permission;
use Pages\Redaksi\Berita\Models\BeritaModel;
use Pages\Redaksi\Berita\Models\ValBerita;

class Berita extends BaseController
{
    private BeritaModel $model;
    private int $tenantId;

    public function __construct()
    {
        $this->model    = new BeritaModel();
        $this->tenantId = (int) session()->get('tenant_id');
    }

    public function index(): string
    {
        Permission::can('redaksi.berita.baca');
        return $this->view('Pages\Redaksi\Berita\Views\index.html', [
            'judul' => 'Manajemen Berita',
        ]);
    }

    // DataTable endpoint
    public function data(): \CodeIgniter\HTTP\ResponseInterface
    {
        Permission::can('redaksi.berita.baca');
        $data = $this->model->getList($this->tenantId);
        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function tambah(): string
    {
        Permission::can('redaksi.berita.tambah');
        return $this->view('Pages\Redaksi\Berita\Views\form.html', [
            'judul' => 'Tambah Berita',
            'data'  => null,
        ]);
    }

    public function edit(): string
    {
        Permission::can('redaksi.berita.edit');
        $id    = (int) decrypt($this->request->getGet('id'));
        $data  = $this->model->getDetail($id, $this->tenantId);
        if (!$data) {
            return redirect()->to('/redaksi/berita')->with('error', 'Berita tidak ditemukan');
        }
        return $this->view('Pages\Redaksi\Berita\Views\form.html', [
            'judul' => 'Edit Berita',
            'data'  => $data,
        ]);
    }

    public function simpan(): \CodeIgniter\HTTP\ResponseInterface
    {
        $isEdit = (bool) $this->request->getPost('id');
        Permission::can($isEdit ? 'redaksi.berita.edit' : 'redaksi.berita.tambah');

        $val = new ValBerita();
        if (!$this->validate((new \Base\Validation\Validation())->rules($val))) {
            return $this->response->setJSON(['status' => false, 'message' => $this->validator->getErrors()]);
        }

        $data = [
            'tenant_id'   => $this->tenantId,    // WAJIB
            'judul'       => $this->request->getPost('judul'),
            'slug'        => url_title($this->request->getPost('judul'), '-', true),
            'konten'      => $this->request->getPost('konten'),
            'kategori_id' => $this->request->getPost('kategori_id'),
            'tanggal'     => $this->request->getPost('tanggal'),
            'status'      => $this->request->getPost('status', FILTER_SANITIZE_NUMBER_INT),
        ];

        if ($isEdit) {
            $data['id'] = (int) decrypt($this->request->getPost('id'));
        }

        $savedId = $this->model->upsert($data);

        // Jika status = publish → generate dan kirim ke Go Edge
        if ($data['status'] == 1) {
            $tenantKode = session()->get('tenant_kode');
            (new Generator())->publish($tenantKode, 'berita', $savedId);
        }

        return $this->response->setJSON(['status' => true, 'message' => 'Berita berhasil disimpan']);
    }

    public function hapus(): \CodeIgniter\HTTP\ResponseInterface
    {
        Permission::can('redaksi.berita.hapus');
        $id = (int) decrypt($this->request->getPost('id'));
        $this->model->where('tenant_id', $this->tenantId)->delete($id);
        return $this->response->setJSON(['status' => true, 'message' => 'Berita berhasil dihapus']);
    }
}
```

- [ ] **Step 4: Buat ValBerita**

```php
// backend/pages/redaksi/Berita/Models/ValBerita.php
namespace Pages\Redaksi\Berita\Models;

class ValBerita
{
    public string $judul       = '`rules=required|string|max_length[255]` `label=Judul`';
    public string $konten      = '`rules=required` `label=Konten`';
    public string $kategori_id = '`rules=required|is_natural_no_zero` `label=Kategori`';
    public string $tanggal     = '`rules=required|valid_date` `label=Tanggal`';
    public string $status      = '`rules=required|in_list[0,1]` `label=Status`';
}
```

- [ ] **Step 5: Routes.php**

```php
$routes->group('redaksi/berita', ['filter' => 'auth:redaksi'], function ($routes) {
    $routes->get('/',         'Pages\Redaksi\Berita\Controllers\Berita::index');
    $routes->get('/data',     'Pages\Redaksi\Berita\Controllers\Berita::data');
    $routes->get('/tambah',   'Pages\Redaksi\Berita\Controllers\Berita::tambah');
    $routes->get('/edit',     'Pages\Redaksi\Berita\Controllers\Berita::edit');
    $routes->post('/simpan',  'Pages\Redaksi\Berita\Controllers\Berita::simpan');
    $routes->post('/hapus',   'Pages\Redaksi\Berita\Controllers\Berita::hapus');
});
```

- [ ] **Step 6: Commit**

```bash
git add pages/redaksi/Berita/
git commit -m "feat: redaksi Berita — full CRUD + publish via Generator→EdgeGrpc (port CI3→CI4)"
```

---

## Task 7–14: Modul Redaksi Lainnya

Setiap modul menggunakan **pola yang sama persis dengan Task 6**. Baca source CI3, port ke CI4, pastikan tenant_id filter ada, pastikan publish dipanggil setelah save.

### Task 7: Redaksi Kategori
**Source:** `redaksi/berita/controllers/Kategori.php` + model  
**Target:** `pages/redaksi/Kategori/`  
**Table:** `cms_kategori`

```bash
git commit -m "feat: redaksi Kategori (port CI3→CI4)"
```

### Task 8: Redaksi Halaman
**Source:** `redaksi/halaman/`  
**Target:** `pages/redaksi/Halaman/`  
**Table:** `cms_halaman`  
**Publish:** `Generator::publish($kode, 'halaman', $id)`

```bash
git commit -m "feat: redaksi Halaman (port CI3→CI4)"
```

### Task 9: Redaksi Galeri
**Source:** `redaksi/galeri/`  
**Target:** `pages/redaksi/Galeri/`  
**Table:** `cms_galeri`

```bash
git commit -m "feat: redaksi Galeri (port CI3→CI4)"
```

### Task 10: Redaksi Agenda
**Source:** `redaksi/agenda/`  
**Target:** `pages/redaksi/Agenda/`  
**Table:** `cms_agenda`

```bash
git commit -m "feat: redaksi Agenda (port CI3→CI4)"
```

### Task 11: Redaksi Pejabat (baru)
**Source:** `redaksi/pejabat/`  
**Target:** `pages/redaksi/Pejabat/` (belum ada — buat dari scratch mengikuti pattern)  
**Table:** `cms_pejabat`  
**Kolom:** `id, tenant_id, nama, jabatan, foto_url, urutan, deleted`

```bash
git commit -m "feat: redaksi Pejabat (baru, port dari acehcms CI3→CI4)"
```

### Task 12: Redaksi Komentar (baru)
**Source:** `redaksi/komentar/`  
**Target:** `pages/redaksi/Komentar/`  
**Table:** `cms_komentar`  
**Fitur:** list komentar pending, approve, hapus (baca dari DB, bukan dari Go Edge)

```bash
git commit -m "feat: redaksi Komentar (baru, moderasi komentar)"
```

### Task 13: Redaksi Slider + Menu + Seo + Tampilan + Media
**Source:** `redaksi/tampilan/`, `redaksi/seo/`, `redaksi/manager/`  
**Target:** `pages/redaksi/Slider/`, `pages/redaksi/Menu/`, `pages/redaksi/Seo/`, `pages/redaksi/Tampilan/`, `pages/redaksi/Media/`

Modul Media (File manager) perlu integrasi `EdgeGrpc::syncFile()` untuk upload.

```bash
git commit -m "feat: redaksi Slider, Menu, Seo, Tampilan, Media (port CI3→CI4)"
```

### Task 14: Redaksi Pengumuman + User (Redaksi)
**Source:** `redaksi/pejabat/` (pengguna), `manage/redaksi/`  
**Target:** `pages/redaksi/Pengumuman/`, `pages/redaksi/User/`

```bash
git commit -m "feat: redaksi Pengumuman, User (port CI3→CI4)"
```

---

## Task 15: Database schema — SQL migration file

**Files:**
- Create: `backend/database/sql/03_redaksi_tambahan.sql` — tabel baru yang ada di acehcms tapi belum di ObongCMS

- [ ] **Step 1: Bandingkan schema acehcms vs ObongCMS**

```bash
# Lihat tabel yang ada di acehcms tapi belum di ObongCMS sql files
grep "CREATE TABLE" /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/codeigniter/application/config/acehcms.php 2>/dev/null || \
grep -r "CREATE TABLE" /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/ --include="*.sql" 2>/dev/null | head -30
```

- [ ] **Step 2: Buat migration SQL untuk tabel baru**

Buat `backend/database/sql/03_redaksi_tambahan.sql` dengan tabel yang belum ada:
```sql
-- cms_pejabat (jika belum ada di 02_content.sql)
CREATE TABLE IF NOT EXISTS `cms_pejabat` (
    `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` INT UNSIGNED NOT NULL,
    `nama`      VARCHAR(255) NOT NULL,
    `jabatan`   VARCHAR(255) NOT NULL,
    `foto_url`  VARCHAR(500) DEFAULT NULL,
    `urutan`    INT DEFAULT 0,
    `deleted`   TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_tenant` (`tenant_id`),
    KEY `idx_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 3: Commit**

```bash
git add database/sql/03_redaksi_tambahan.sql
git commit -m "feat: tambah SQL migration untuk tabel redaksi baru (pejabat, dll)"
```

---

## Task 16: End-to-end manual test seluruh flow

- [ ] **Step 1: Jalankan backend dan frontend**

```bash
# Terminal 1: Go Edge
cd /home/obong/Codes/project_codes/ObongCMS/frontend
make dev

# Terminal 2: PHP-FPM sudah jalan via Nginx
sudo service php8.4-fpm restart
```

- [ ] **Step 2: Test flow lengkap**

1. Buka `http://panel.obongcms.local/panel/auth` → login sebagai DEV
2. Buat tenant baru → verifikasi SyncDomainConfig terkirim ke Go Edge (cek log)
3. Login sebagai REDAKSI di `http://redaksi.demo.local/redaksi/auth`
4. Buat berita → Publish → verifikasi `curl http://demo.local/berita` menampilkan berita
5. Upload media → verifikasi file muncul di `http://demo.local/media/berita/foto.jpg`

- [ ] **Step 3: Fix bugs yang ditemukan**

```bash
# Setiap fix:
git add -A
git commit -m "fix: [deskripsi bug]"
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: port lengkap CI3→CI4 semua modul panel dan redaksi — ObongCMS MVP selesai"
```
