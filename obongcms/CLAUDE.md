# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ObongCMS** — multi-tenant CMS platform for news and government websites. Single CI4 installation serves many domains/organizations via Go Edge renderer. Designed as a base project: clone → customize → deploy.

## Architecture

Two services communicating via HTTP internal API:

| Service | Stack | Local URL | Folder |
|---------|-------|-----------|--------|
| Backend (admin panel + redaksi + API) | CI4 / PHP 8.4 + MySQL + Nginx | `http://panel.obongcms.local` | `backend/` |
| Go Edge (public renderer) | Go + Chi v5 | `http://{domain}.local` | `frontend/` |

**Key rule**: CI4 **never** writes directly to the Go Edge filesystem. CI4 sends JSON payloads to `/api/internal/*` on Go Edge via Nginx proxy.

**Publish flow**: CI4 `Generator.php` builds JSON snapshots from DB → sends to Go Edge via `GoEdge.php` library → Go Edge stores snapshots in `runtime/public/tenants/{domain}/` and serves them.

**Multi-domain resolution**: Go Edge reads `Host` header from Nginx (`proxy_set_header Host $host`) → maps to tenant → serves from tenant snapshot folder.

## Running Locally (WSL + Nginx, no Docker)

### Setup (once)
```bash
# Symlink Nginx configs
sudo ln -sf $(pwd)/backend/nginx/panel.obongcms.local.conf  /etc/nginx/sites-enabled/
sudo ln -sf $(pwd)/backend/nginx/redaksi.obongcms.local.conf /etc/nginx/sites-enabled/
sudo ln -sf $(pwd)/backend/nginx/edge.obongcms.local.conf   /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload

# /etc/hosts (add per new tenant too)
# 127.0.0.1  panel.obongcms.local obongcms.local
```

### Start backend
```bash
sudo service php8.4-fpm start
# CI4 at http://panel.obongcms.local (no spark — served directly via Nginx + PHP-FPM)
```

### Start Go Edge
```bash
cd frontend
make dev          # hot-reload via air
# OR: go run main.go
# Runs on :9090, health: curl http://obongcms.local/health
```

## Backend (CI4) Commands

```bash
cd backend
composer install
composer cs       # php-cs-fixer
composer sa       # phpstan static analysis
```

## Frontend (Go) Commands

```bash
cd frontend
make install      # go mod download + tidy
make dev          # hot-reload (air)
make build        # compile to bin/server
make lint         # golangci-lint ./...
make test         # go test -v -race ./...
make test-coverage  # generates coverage.html
make fmt          # go fmt
make vet          # go vet
make migrate      # run migrations
make migrate-up / migrate-down / migrate-fresh / migrate-status
```

## URL Routing

| URL | Service |
|-----|---------|
| `http://panel.obongcms.local` | CI4 panel (DEV/superadmin) |
| `http://redaksi.demo.local` | CI4 redaksi CMS for tenant `demo` |
| `http://demo.local` | Public site for tenant `demo` (Go Edge) |
| `http://demo.local/berita/{slug}` | Article detail (Go Edge) |

Test Go Edge directly (bypassing Nginx):
```bash
curl -H "Host: demo.local" http://localhost:9090/berita
```

## Environment Variables

`backend/.env` (key additions beyond `.env.example`):
```
GOEDGE_URL=http://localhost:9090
GOEDGE_SECRET=obong_internal_secret_2026
API_KEY=obong_api_key_2026
```

`frontend/.env` (key additions):
```
APP_PORT=9090
RUNTIME_PATH=./runtime
GOEDGE_SECRET=obong_internal_secret_2026   # must match backend
BACKEND_URL=http://panel.obongcms.local
BACKEND_API_KEY=obong_api_key_2026
```

## Backend Code Conventions (Mandatory)

- **Namespace**: `Base\` → `base/`, modules in `pages/panel/` and `pages/redaksi/`
- **Module structure**: each module has `Controllers/`, `Models/`, `Views/`, `Config/`
- **Permission**: every controller method **must** call `Permission::can('category.module.action')`
- **Tenant isolation**: all redaksi queries **must** filter `WHERE tenant_id = ?` — no exceptions, no cross-tenant leaks
- **ID encryption**: URLs always use `encrypt()` on output, `decrypt()` on input
- **Validation**: use `ValModuleName` class with field DSL via `$validation->valid($valModel)`
- **Model upsert**: use `upsert()` for insert/update, `delete()` for soft delete
- **Views**: Twig `.html` templates only (no PHP views)
- **API response format**: `{ "status": true, "message": "...", "data": {} }`
- **Code comments & local variables**: Bahasa Indonesia
- **Scope discipline**: don't refactor outside task scope, don't suggest new libraries unprompted

## Key Backend Files

| Component | Path |
|-----------|------|
| CI4 → Go Edge sync | `backend/base/Libraries/GoEdge.php` |
| JSON snapshot builder | `backend/base/Libraries/Generator.php` |
| Base controller | `backend/base/Controllers/BaseController.php` |
| Base model (DSL) | `backend/base/Models/BaseModel.php` |
| Auth schema | `backend/database/sql/01_platform.sql` (authoritative) |
| CMS schema | `backend/database/sql/02_content.sql` |

## Key Go Edge Files

| Component | Path |
|-----------|------|
| Entrypoint | `frontend/main.go` |
| Internal API handler | `frontend/modules/internalapi/handler.go` |
| Public site handler | `frontend/modules/site/handler.go` |
| Domain resolver | `frontend/internal/domainresolver/domainresolver.go` |
| Tenant filesystem | `frontend/internal/tenantfs/tenantfs.go` |

## Reference Docs (load as needed)

- Module list & paths → `backend/docs/module_index.md`
- **Helpers & libraries** → `backend/docs/helpers_index.md` ← read before creating new utilities
- CI4 patterns & conventions → `backend/docs/ci4_conventions.md`
- Generator (JSON snapshot per content type) → `backend/docs/generator/index.md`
- Role/permission system → `backend/memory/project_role_system.md`
- DB relationships → `backend/memory/project_database.md`
- Active specs/plans → `backend/docs/superpowers/`
- Applied fixes (don't repeat) → `backend/memory/feedback_fixes.md`
- Pre-production security checklist → `SECURITY.md`

## Role System (4 roles)

| Role | Scope |
|------|-------|
| DEV | Full system access |
| ADMIN_WILAYAH | Region-scoped (province/district) |
| ADMIN_TENANT | Single tenant |
| REDAKSI | Content only, within one tenant |

## Slash Commands (backend/.claude/commands/)

28 available commands. Key ones:
- `/new-task [description]` — start a task
- `/crud NamaModul` — generate full CRUD module
- `/migration nama_tabel` — generate migration
- `/test` — Playwright UI test guide
- `/datatable`, `/form-view`, `/index-view`, `/permission`, `/routes` — reference docs
