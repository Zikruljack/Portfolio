# ObongCMS — Task List
> Update file ini saat task selesai atau prioritas berubah.
> Detail per area → folder `tasks/`

## Status Legenda
- `[ ]` Belum mulai
- `[~]` Sedang dikerjakan / scaffolded tapi belum complete
- `[x]` Selesai

---

## Ringkasan Progress

| Area | Scaffolded | Implementation | Views/Templates | Status |
|------|-----------|----------------|-----------------|--------|
| Backend – Panel (IAM, Tenant) | ✓ | ~50% | Belum | [~] |
| Backend – Redaksi (CMS) | ✓ | ~40% | Belum | [~] |
| Backend – API endpoint | ~50% | Belum | – | [~] |
| Frontend – Go Edge | base ✓ | Belum | Belum | [~] |
| Deploy – Public | Belum | Belum | – | [ ] |
| Deploy – Private/Gov | Belum | Belum | – | [ ] |
| Migrasi Legacy | Plan ada | Belum | – | [ ] |

---

## File Detail

| File | Isi |
|------|-----|
| `ARCHITECTURE.md` | **Baca ini dulu** — alur sistem, topologi, flow diagram |
| `tasks/01-backend-panel.md` | Panel: Auth, IAM, Tenant, Domain, Settings |
| `tasks/02-backend-redaksi.md` | Redaksi: modul CMS per domain |
| `tasks/03-frontend-edge.md` | Go edge: domain resolver, renderer, publish cache |
| `tasks/04-deploy-migration.md` | Deploy config, legacy data import |
