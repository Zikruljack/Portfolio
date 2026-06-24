# Plan B: CI4 Backend — PHP gRPC Client (EdgeGrpc.php)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti `GoEdge.php` (HTTP curl) dengan `EdgeGrpc.php` (gRPC client PHP), generate PHP proto stubs, dan pastikan CI4 bisa berkomunikasi dengan Go Edge via gRPC untuk semua operasi: publish konten, upload media, invalidate cache, sync domain config.

**Architecture:** PHP menggunakan library `grpc/grpc` (PECL extension) + `google/protobuf` via Composer. Proto file di `backend/proto/edge_sync.proto` di-compile ke PHP stubs di `backend/proto/gen/`. `EdgeGrpc.php` menggantikan `GoEdge.php` sepenuhnya — semua caller diupdate. `GoEdge.php` dihapus.

**Tech Stack:** PHP 8.4, grpc/grpc PECL extension, grpc/grpc Composer package, google/protobuf, protoc + protoc-gen-php + protoc-gen-grpc-php

## Global Constraints

- Namespace CI4: `Base\Libraries\EdgeGrpc`
- gRPC secret: dari env `GRPC_SECRET` (bukan `GOEDGE_SECRET`)
- gRPC host: dari env `GRPC_HOST` (format `host:port`, contoh `localhost:50051`)
- Semua referensi `GoEdge` → `EdgeGrpc` di seluruh codebase
- Komentar kode & variabel lokal: Bahasa Indonesia
- `composer sa` (phpstan) dan `composer cs` (php-cs-fixer) harus pass setelah setiap task

---

## File Structure

```
backend/
├── proto/
│   ├── edge_sync.proto          ← sudah ada, tidak diubah
│   └── gen/                     ← BARU: output protoc untuk PHP
│       ├── Edgesync/
│       │   ├── EdgeSyncClient.php
│       │   ├── SyncResult.php
│       │   ├── Result.php
│       │   ├── SnapshotPayload.php
│       │   ├── FileChunk.php
│       │   ├── TenantKey.php
│       │   └── DomainConfig.php
│       └── GPBMetadata/
│           └── EdgeSync.php
├── base/Libraries/
│   ├── EdgeGrpc.php             ← BARU: gRPC client (ganti GoEdge.php)
│   └── GoEdge.php               ← HAPUS setelah semua caller diupdate
├── composer.json                ← MODIFY: tambah grpc/grpc, google/protobuf
└── Makefile                     ← BARU: target proto-php dan proto-go
```

---

## Task 1: Setup PHP gRPC extension dan Composer packages

**Files:**
- Modify: `backend/composer.json`
- Create: `backend/Makefile`

**Interfaces:**
- Produces: `grpc/grpc` dan `google/protobuf` tersedia via `vendor/`

- [ ] **Step 1: Cek apakah PHP gRPC extension sudah terinstall**

```bash
php -m | grep grpc
```

Jika tidak ada output, install:
```bash
sudo pecl install grpc
# Tambahkan ke php.ini jika belum ada:
echo "extension=grpc.so" | sudo tee -a /etc/php/8.4/fpm/conf.d/grpc.ini
echo "extension=grpc.so" | sudo tee -a /etc/php/8.4/cli/php.ini
sudo service php8.4-fpm restart
```

- [ ] **Step 2: Verifikasi extension aktif**

```bash
php -m | grep grpc
```
Expected: `grpc`

- [ ] **Step 3: Tambahkan packages ke composer.json**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
composer require grpc/grpc:^1.57 google/protobuf:^3.25
```

- [ ] **Step 4: Verifikasi install berhasil**

```bash
composer show grpc/grpc google/protobuf
```
Expected: kedua package muncul dengan versi yang benar

- [ ] **Step 5: Buat Makefile di backend/**

```makefile
# backend/Makefile
.PHONY: proto-php proto-go

# Generate PHP stubs dari proto file
proto-php:
	protoc \
		--proto_path=proto \
		--php_out=proto/gen \
		--grpc_out=proto/gen \
		--plugin=protoc-gen-grpc=$$(which grpc_php_plugin) \
		proto/edge_sync.proto
	@echo "PHP stubs berhasil di-generate ke proto/gen/"

# Generate Go stubs dari proto file (jalankan dari frontend/)
proto-go:
	cd ../frontend && protoc \
		--proto_path=../backend/proto \
		--go_out=internal/grpcserver/gen \
		--go-grpc_out=internal/grpcserver/gen \
		--go_opt=paths=source_relative \
		--go-grpc_opt=paths=source_relative \
		../backend/proto/edge_sync.proto
	@echo "Go stubs berhasil di-generate ke frontend/internal/grpcserver/gen/"
```

- [ ] **Step 6: Commit**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
git add composer.json composer.lock Makefile
git commit -m "chore: tambah grpc/grpc dan google/protobuf, buat Makefile untuk proto generation"
```

---

## Task 2: Generate PHP proto stubs

**Files:**
- Create: `backend/proto/gen/Edgesync/EdgeSyncClient.php` (dan file lainnya — auto-generated)

**Interfaces:**
- Produces: PHP class `Edgesync\EdgeSyncClient`, `Edgesync\SnapshotPayload`, `Edgesync\FileChunk`, `Edgesync\TenantKey`, `Edgesync\DomainConfig`, `Edgesync\SyncResult`, `Edgesync\Result`

- [ ] **Step 1: Pastikan protoc dan grpc_php_plugin terinstall**

```bash
protoc --version
which grpc_php_plugin || echo "TIDAK ADA"
```

Jika `grpc_php_plugin` tidak ada:
```bash
# Build dari source atau install via:
sudo apt install -y protobuf-compiler
# grpc_php_plugin biasanya ada di PECL grpc build artifacts:
find ~/.pearrc /tmp /usr/local -name "grpc_php_plugin" 2>/dev/null | head -3
# Atau build manual:
# git clone https://github.com/grpc/grpc.git && cd grpc && make grpc_php_plugin
```

- [ ] **Step 2: Generate PHP stubs**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
mkdir -p proto/gen
make proto-php
```
Expected: file-file PHP muncul di `proto/gen/`

- [ ] **Step 3: Verifikasi file yang di-generate**

```bash
find proto/gen -name "*.php" | sort
```
Expected output (minimal):
```
proto/gen/Edgesync/DomainConfig.php
proto/gen/Edgesync/EdgeSyncClient.php
proto/gen/Edgesync/FileChunk.php
proto/gen/Edgesync/Result.php
proto/gen/Edgesync/SnapshotPayload.php
proto/gen/Edgesync/SyncResult.php
proto/gen/Edgesync/TenantKey.php
proto/gen/GPBMetadata/EdgeSync.php
```

- [ ] **Step 4: Tambahkan proto/gen/ ke autoloader CI4**

Tambahkan ke `backend/app/Config/Autoload.php` atau `base/Config/Autoload.php`:
```php
// Tambahkan di array $classmap atau $psr4:
'Edgesync' => ROOTPATH . 'proto/gen/Edgesync',
'GPBMetadata' => ROOTPATH . 'proto/gen/GPBMetadata',
```

Atau jika menggunakan Composer autoload, tambahkan ke `composer.json`:
```json
{
    "autoload": {
        "psr-4": {
            "Edgesync\\": "proto/gen/Edgesync/",
            "GPBMetadata\\": "proto/gen/GPBMetadata/"
        }
    }
}
```
Lalu: `composer dump-autoload`

- [ ] **Step 5: Verifikasi autoload**

```bash
php -r "require 'vendor/autoload.php'; \$c = new Edgesync\SnapshotPayload(); echo 'OK';"
```
Expected: `OK`

- [ ] **Step 6: Tambahkan proto/gen/ ke .gitignore atau commit**

File PHP stubs sebaiknya di-commit (bukan di-gitignore) supaya tidak perlu `protoc` di setiap environment:
```bash
git add proto/gen/
git commit -m "feat: generate PHP proto stubs dari edge_sync.proto"
```

---

## Task 3: Implement EdgeGrpc.php

**Files:**
- Create: `backend/base/Libraries/EdgeGrpc.php`
- Test: manual test via `php artisan` atau script test sederhana

**Interfaces:**
- Consumes: `Edgesync\EdgeSyncClient`, semua message classes (Task 2)
- Produces:
  - `EdgeGrpc::syncSnapshot(string $tenantCode, string $jsonPath, string $content): bool`
  - `EdgeGrpc::syncFile(string $tenantCode, string $filePath, UploadedFile $file): ?string`
  - `EdgeGrpc::invalidateCache(string $tenantCode): bool`
  - `EdgeGrpc::syncDomainConfig(string $tenantCode, string $domain, string $theme, bool $maintenance, string $redaksiUrl): bool`

- [ ] **Step 1: Buat EdgeGrpc.php**

```php
<?php

namespace Base\Libraries;

use CodeIgniter\HTTP\Files\UploadedFile;
use Edgesync\DomainConfig;
use Edgesync\EdgeSyncClient;
use Edgesync\FileChunk;
use Edgesync\SnapshotPayload;
use Edgesync\TenantKey;
use Grpc\ChannelCredentials;
use Throwable;

/**
 * EdgeGrpc — klien gRPC untuk komunikasi CI4 ke Go Edge.
 * Menggantikan GoEdge.php (HTTP curl) dengan gRPC murni.
 */
class EdgeGrpc
{
    private EdgeSyncClient $client;
    private array $metadata;

    public function __construct()
    {
        $host   = env('GRPC_HOST', 'localhost:50051');
        $secret = env('GRPC_SECRET', '');

        $this->client = new EdgeSyncClient($host, [
            'credentials' => ChannelCredentials::createInsecure(),
        ]);

        // metadata dikirim di setiap RPC call untuk autentikasi
        $this->metadata = $secret !== '' ? ['x-grpc-secret' => [$secret]] : [];
    }

    /**
     * Kirim snapshot JSON konten ke Go Edge.
     * $jsonPath adalah path relatif dari runtime/tenants/{code}/json/, misal: "berita.json"
     */
    public function syncSnapshot(string $tenantCode, string $jsonPath, string $content): bool
    {
        try {
            $payload = new SnapshotPayload();
            $payload->setTenantCode($tenantCode);
            $payload->setJsonPath($jsonPath);
            $payload->setContent($content);

            [$response, $status] = $this->client->SyncSnapshot($payload, $this->metadata)->wait();

            if ($status->code !== \Grpc\STATUS_OK) {
                log_message('error', "EdgeGrpc::syncSnapshot — gRPC error {$status->code}: {$status->details}");
                return false;
            }

            return $response->getSuccess();
        } catch (Throwable $e) {
            log_message('error', 'EdgeGrpc::syncSnapshot — ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Upload file media ke Go Edge via gRPC streaming.
     * Return path relatif publik (misal: "/media/berita/foto.jpg") atau null jika gagal.
     */
    public function syncFile(string $tenantCode, string $filePath, UploadedFile $file): ?string
    {
        try {
            $call = $this->client->SyncFile($this->metadata);

            // Baca file dalam chunks 64KB
            $fp        = fopen($file->getTempName(), 'rb');
            $chunkSize = 65536; // 64KB

            while (!feof($fp)) {
                $data  = fread($fp, $chunkSize);
                $chunk = new FileChunk();
                $chunk->setTenantCode($tenantCode);
                $chunk->setFilePath($filePath);
                $chunk->setContent($data);
                $chunk->setIsLast(feof($fp));
                $call->write($chunk);
            }
            fclose($fp);

            [$response, $status] = $call->wait();

            if ($status->code !== \Grpc\STATUS_OK) {
                log_message('error', "EdgeGrpc::syncFile — gRPC error {$status->code}: {$status->details}");
                return null;
            }

            if (!$response->getSuccess()) {
                log_message('error', 'EdgeGrpc::syncFile — ' . $response->getMessage());
                return null;
            }

            // Return path relatif yang bisa digunakan di URL publik
            return '/media/' . ltrim($filePath, '/');
        } catch (Throwable $e) {
            log_message('error', 'EdgeGrpc::syncFile — ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Invalidate in-memory cache untuk tenant tertentu di Go Edge.
     */
    public function invalidateCache(string $tenantCode): bool
    {
        try {
            $key = new TenantKey();
            $key->setTenantCode($tenantCode);

            [$response, $status] = $this->client->InvalidateCache($key, $this->metadata)->wait();

            if ($status->code !== \Grpc\STATUS_OK) {
                log_message('error', "EdgeGrpc::invalidateCache — gRPC error {$status->code}: {$status->details}");
                return false;
            }

            return $response->getSuccess();
        } catch (Throwable $e) {
            log_message('error', 'EdgeGrpc::invalidateCache — ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Update konfigurasi domain di Go Edge domain resolver.
     * Dipanggil saat tenant dibuat, domain diubah, atau maintenance toggle.
     */
    public function syncDomainConfig(
        string $tenantCode,
        string $domain,
        string $theme,
        bool   $maintenance,
        string $redaksiUrl
    ): bool {
        try {
            $cfg = new DomainConfig();
            $cfg->setTenantCode($tenantCode);
            $cfg->setDomain($domain);
            $cfg->setTheme($theme);
            $cfg->setMaintenance($maintenance);
            $cfg->setRedaksiUrl($redaksiUrl);

            [$response, $status] = $this->client->SyncDomainConfig($cfg, $this->metadata)->wait();

            if ($status->code !== \Grpc\STATUS_OK) {
                log_message('error', "EdgeGrpc::syncDomainConfig — gRPC error {$status->code}: {$status->details}");
                return false;
            }

            return $response->getSuccess();
        } catch (Throwable $e) {
            log_message('error', 'EdgeGrpc::syncDomainConfig — ' . $e->getMessage());
            return false;
        }
    }
}
```

- [ ] **Step 2: Verifikasi syntax PHP**

```bash
php -l /home/obong/Codes/project_codes/ObongCMS/backend/base/Libraries/EdgeGrpc.php
```
Expected: `No syntax errors detected`

- [ ] **Step 3: Run phpstan**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
composer sa
```
Expected: tidak ada error baru terkait EdgeGrpc.php

- [ ] **Step 4: Commit**

```bash
git add base/Libraries/EdgeGrpc.php
git commit -m "feat: implement EdgeGrpc.php (gRPC client — ganti GoEdge.php HTTP curl)"
```

---

## Task 4: Update semua caller GoEdge → EdgeGrpc, hapus GoEdge.php

**Files:**
- Modify: semua file yang import/use `GoEdge`
- Delete: `backend/base/Libraries/GoEdge.php`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `EdgeGrpc` (Task 3)
- Produces: tidak ada reference ke `GoEdge` di seluruh codebase

- [ ] **Step 1: Cari semua file yang menggunakan GoEdge**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
grep -r "GoEdge\|GOEDGE" --include="*.php" -l
```

- [ ] **Step 2: Update setiap file yang menggunakan GoEdge**

Untuk setiap file yang ditemukan, ganti:
```php
use Base\Libraries\GoEdge;
// atau
$goEdge = new GoEdge();
// atau
new \Base\Libraries\GoEdge()
```
→
```php
use Base\Libraries\EdgeGrpc;
// atau
$edge = new EdgeGrpc();
```

Update method calls:
```php
// publishContent(domain, files) tidak ada 1:1 mapping — perlu loop per file:
// GoEdge pattern:
$goEdge->publishContent($domain, $files);

// EdgeGrpc pattern:
$edge = new EdgeGrpc();
foreach ($files as $file) {
    $edge->syncSnapshot($tenantCode, $file['path'], $file['content']);
}

// uploadMedia:
$goEdge->uploadMedia($domain, $folder, $uploadedFile);
// →
$edge->syncFile($tenantCode, $folder . '/' . $uploadedFile->getClientName(), $uploadedFile);

// syncDomains — tidak ada equivalent langsung, skip atau implement via loop SyncDomainConfig

// createTenant:
$goEdge->createTenant($domain, $setting);
// →
$edge->syncDomainConfig($tenantCode, $domain, $setting['tema_id'] ?? 'default', false, $redaksiUrl);

// deleteTenant:
$goEdge->deleteTenant($domain);
// →
$edge->invalidateCache($tenantCode);
// (Go Edge akan 404 karena resolver di-clear, folder tidak dihapus dari Go Edge — CI4 juga tidak lagi delete)
```

- [ ] **Step 3: Update .env.example**

```bash
cat > /home/obong/Codes/project_codes/ObongCMS/backend/.env.example << 'EOF'
# ObongCMS Backend — environment variables

# CodeIgniter
CI_ENVIRONMENT=development

# Database
database.default.hostname=localhost
database.default.database=obongcms
database.default.username=root
database.default.password=
database.default.DBDriver=MySQLi
database.default.port=3306

# Enkripsi session
encryption.key=

# gRPC ke Go Edge (harus sama persis dengan frontend GRPC_SECRET)
GRPC_HOST=localhost:50051
GRPC_SECRET=obong_grpc_secret_2026

# Email SMTP
email.protocol=smtp
email.SMTPHost=smtp.gmail.com
email.SMTPUser=
email.SMTPPass=
email.SMTPPort=587

# Telegram notifikasi (opsional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
```

- [ ] **Step 4: Hapus GoEdge.php**

```bash
rm /home/obong/Codes/project_codes/ObongCMS/backend/base/Libraries/GoEdge.php
```

- [ ] **Step 5: Verifikasi tidak ada referensi GoEdge tersisa**

```bash
grep -r "GoEdge\|GOEDGE_URL\|GOEDGE_SECRET" --include="*.php" .
```
Expected: tidak ada output

- [ ] **Step 6: Run phpstan dan cs-fixer**

```bash
composer sa
composer cs
```
Expected: tidak ada error baru

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace semua GoEdge → EdgeGrpc, hapus GoEdge.php, update .env.example"
```

---

## Task 5: Update Generator.php untuk semua content type dari acehcms

**Files:**
- Modify: `backend/base/Libraries/Generator.php`

**Interfaces:**
- Consumes: `EdgeGrpc` (Task 3)
- Produces: `Generator::publish(string $tenantCode, string $type, int $id): bool` — support semua tipe dari acehcms: berita, halaman, galeri, pejabat, agenda, pengumuman, slider, menu, setting, domain

- [ ] **Step 1: Baca Generator.php yang ada dan acehcms generator/**

```bash
cat /home/obong/Codes/project_codes/ObongCMS/backend/base/Libraries/Generator.php | head -80
ls /home/obong/Codes/siat_codes/2026/acehcms-v5/acehcms-v5/backend_be/generator/
```

- [ ] **Step 2: Port logika dari masing-masing generator acehcms**

Untuk setiap tipe (`berita`, `halaman`, `galeri`, `pejabat`, `agenda`, `pengumuman`, `slider`, `menu`, `setting`):

Pola CI3 (acehcms):
```php
function generated_berita($option = []) {
    $ci =& get_instance();
    $berita = $ci->db->query("SELECT ... FROM berita WHERE id='$berita_id' AND domain_id='".domain_id()."'")->row_array();
    return [["filename" => $berita['slug'].'.json', "content" => json_encode($berita)]];
}
```

Pola CI4 (ObongCMS):
```php
// Di dalam class Generator
private function buildBerita(string $tenantCode, int $id): array
{
    $db = db_connect();
    $berita = $db->table('cms_berita b')
        ->join('cms_kategori bk', 'bk.id = b.kategori_id', 'left')
        ->join('app_users ap', 'ap.id = IF(b.modified_by=0,b.created_by,b.modified_by)', 'left')
        ->select('b.judul, b.konten, CONCAT(bk.full_slug,"/",b.slug) AS slug, b.thumb_url as gambar, ...')
        ->where('b.id', $id)
        ->where('b.tenant_id', $tenantCode)  // WAJIB: tenant isolation
        ->where('b.tanggal <=', date('Y-m-d H:i:s'))
        ->get()->getRowArray();

    if (!$berita) {
        return [];
    }
    $berita['tanggal'] = /* format tanggal */;
    // ... tambah kategori, tags, meta
    return [['path' => $berita['slug'] . '.json', 'content' => json_encode($berita)]];
}
```

> **PENTING:** Semua query WAJIB include `WHERE tenant_id = $tenantCode`. Lihat `docs/ci4_conventions.md` untuk SQL schema.

- [ ] **Step 3: Pastikan publish() method memanggil EdgeGrpc**

```php
public function publish(string $tenantCode, string $type, int $id): bool
{
    $edge  = new EdgeGrpc();
    $files = match ($type) {
        'berita'      => $this->buildBerita($tenantCode, $id),
        'halaman'     => $this->buildHalaman($tenantCode, $id),
        'galeri'      => $this->buildGaleri($tenantCode, $id),
        'pejabat'     => $this->buildPejabat($tenantCode, $id),
        'agenda'      => $this->buildAgenda($tenantCode, $id),
        'pengumuman'  => $this->buildPengumuman($tenantCode, $id),
        'slider'      => $this->buildSlider($tenantCode),
        'menu'        => $this->buildMenu($tenantCode),
        'setting'     => $this->buildSetting($tenantCode),
        default       => [],
    };

    if (empty($files)) {
        return false;
    }

    $berhasil = true;
    foreach ($files as $file) {
        if (!$edge->syncSnapshot($tenantCode, $file['path'], $file['content'])) {
            $berhasil = false;
        }
    }
    return $berhasil;
}
```

- [ ] **Step 4: Run phpstan**

```bash
composer sa
```
Expected: tidak ada error baru

- [ ] **Step 5: Commit**

```bash
git add base/Libraries/Generator.php
git commit -m "feat: extend Generator.php — port semua content type dari acehcms + pakai EdgeGrpc"
```

---

## Task 6: Smoke test koneksi CI4 → Go Edge via gRPC

**Files:**
- Create: `backend/tests/GrpcSmokeTest.php` (manual test script, bukan PHPUnit)

**Interfaces:**
- Consumes: `EdgeGrpc` (Task 3), Go Edge server yang berjalan (Plan A selesai)

- [ ] **Step 1: Pastikan Go Edge berjalan**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/frontend
make dev &
sleep 3
# atau
go run main.go &
```

- [ ] **Step 2: Buat smoke test script**

```php
<?php
// backend/tests/GrpcSmokeTest.php
// Jalankan dengan: php tests/GrpcSmokeTest.php

define('FCPATH', __DIR__ . '/../public/');
require __DIR__ . '/../vendor/autoload.php';

// Set env manual untuk test
putenv('GRPC_HOST=localhost:50051');
putenv('GRPC_SECRET=obong_grpc_secret_2026');

use Base\Libraries\EdgeGrpc;

$edge = new EdgeGrpc();

// Test 1: SyncSnapshot
echo "Test 1: SyncSnapshot... ";
$result = $edge->syncSnapshot('testdemo', 'berita.json', json_encode(['data' => []]));
echo $result ? "PASS\n" : "FAIL\n";

// Test 2: SyncDomainConfig
echo "Test 2: SyncDomainConfig... ";
$result = $edge->syncDomainConfig('testdemo', 'testdemo.local', 'default', false, 'redaksi.testdemo.local');
echo $result ? "PASS\n" : "FAIL\n";

// Test 3: InvalidateCache
echo "Test 3: InvalidateCache... ";
$result = $edge->invalidateCache('testdemo');
echo $result ? "PASS\n" : "FAIL\n";

echo "Selesai.\n";
```

- [ ] **Step 3: Jalankan smoke test**

```bash
cd /home/obong/Codes/project_codes/ObongCMS/backend
php tests/GrpcSmokeTest.php
```
Expected:
```
Test 1: SyncSnapshot... PASS
Test 2: SyncDomainConfig... PASS
Test 3: InvalidateCache... PASS
Selesai.
```

- [ ] **Step 4: Commit**

```bash
git add tests/GrpcSmokeTest.php
git commit -m "test: tambah smoke test PHP→Go gRPC (SyncSnapshot, SyncDomainConfig, InvalidateCache)"
```
