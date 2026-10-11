# UpWeGo Project Memory

**Last reviewed:** 2026-10-11

## Handoff

Phase 3 client/project database migrations are applied to UpWeGo - Development, and workspace routes/server actions are implemented. TypeScript, lint, build, and formatting checks pass. Treat Phase 3 as implemented but **not integration verified/release ready**: authenticated application workflows/cross-tenant tests and Phase 1/2 account regressions have not run. See [TASK.md](./TASK.md) for exact open checks and [ARCHITECTURE.md](./ARCHITECTURE.md) for current schema/access rules.

## Durable decisions

- Product name is **UpWeGo**. [PRD.md](./PRD.md) remains the product authority and should not be narrowed to match implementation progress.
- Keep Next.js App Router, React, TypeScript strict, Tailwind, shadcn-style/Radix UI, Supabase/PostgreSQL/Auth/RLS, and Zod. Keep a modular monolith; actions use the authenticated Supabase session client.
- Organization context is derived from signed-in membership. Never trust client-supplied organization IDs, roles, or permissions.
- Client contact data is readable to organization members; client tax IDs/internal notes are separately stored for Owner/Project Manager access.
- Organization-wide projects are visible to organization members. Restricted projects require an assigned view permission, with Owner access. Project edits, team management, visibility, and private fields have separate checks. Sensitive project data is stored in `project_private_details` with RLS.
- Tenant integrity uses composite organization foreign keys. Project deletion cascades to its members/details; client deletion is restricted while projects reference it. Archive clients to preserve relationships/history.
- For schema/RLS changes, add timestamped migration files under `supabase/migrations/`, preserve `first.sql`, review before apply, record the exact remote migration version in the filename, and tell the owner which environment received it. Do not make untracked DB changes.
- Never use a service-role credential in browser code or docs. Do not commit secrets.

## Phase 3 migrations and database

- `20261011170350_phase3_clients_projects.sql` applied to `zuwtrchxgbipurwslusy` (UpWeGo - Development): `clients`, `client_private_details`, `projects`, `project_members`, `project_private_details`, constraints, indexes, RLS, helper functions, and least grants.
- `20261011170600_phase3_project_access_controls.sql` applied to Development: corrected sensitive access predicates and atomically adds the creator's scoped project-member row.
- `first.sql` was not changed. No existing client/project data existed to migrate or delete.
- Supabase advisor showed no Phase 3 security finding. Existing notices: invitation preview/acceptance RPCs are executable as designed; leaked-password protection is disabled. Performance notice: `organization_invitations.invited_by` lacks an index; Phase 3 indexes report unused because the new tables have no representative rows.

## Code and verification status

- Added client/project routes under `src/app/(app)/clients` and `projects`, actions in `src/app/actions/clients-projects.ts`, Zod schemas in `src/lib/validations`, and shared record form UI.
- Sidebar navigation is active; dashboard client/project counts query persisted RLS-filtered records.
- `npm run lint` completed with the Next.js `next lint` deprecation notice.
- The first build exposed `never` inference on new generated table queries. A strict typed server-query surface based on local row/insert/update declarations resolved it; `npx tsc --noEmit` and `npm run build` now pass without `any` or compiler suppression.
- `npm run lint` passes with the existing Next.js `next lint` deprecation message. Prettier checks pass.
- No test runner exists. No app-backed Phase 3 test, authorization matrix, or live cross-organization query test was completed. Existing owner-reported Phase 2 flows were not rerun; no test account credentials were available through the connected database tools.

## Continue safely

1. Use authenticated test accounts to verify client create/edit/search/archive, project status/client/visibility/member controls, and Owner/PM/Employee access including a second organization. Rerun auth, org creation, and invite acceptance/rejection/revocation/expiry flows.
2. If a schema fix is required, create and review another timestamped migration; never patch Development directly and never rewrite `first.sql`.
3. Update [TASK.md](./TASK.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and this file with actual check outcomes. Phase 4 is not started until the owner requests it.
