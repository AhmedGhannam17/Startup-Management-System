# UpWeGo Project Memory

**Last reviewed:** 2026-11-08

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
- Server actions must translate database failures to safe, user-friendly messages; never send raw Postgres/PostgREST error text to the UI. `src/lib/errors.ts` is the shared mapper.
- Never use a service-role credential in browser code or docs. Do not commit secrets.

## Phase 3 migrations and database

- `20261011170350_phase3_clients_projects.sql` applied to `zuwtrchxgbipurwslusy` (UpWeGo - Development): `clients`, `client_private_details`, `projects`, `project_members`, `project_private_details`, constraints, indexes, RLS, helper functions, and least grants.
- `20261011170600_phase3_project_access_controls.sql` applied to Development: corrected sensitive access predicates and atomically adds the creator's scoped project-member row.
- `20261012141701_project_creator_rls.sql` applied to Development: assigns `projects.created_by` from database `auth.uid()` in a BEFORE INSERT trigger and keeps project INSERT restricted to organization admins through `private.is_org_admin`.
- `first.sql` was not changed. No existing client/project data existed to migrate or delete.
- Supabase advisor showed no Phase 3 security finding. Existing notices: invitation preview/acceptance RPCs are executable as designed; leaked-password protection is disabled. Performance notice: `organization_invitations.invited_by` lacks an index; Phase 3 indexes report unused because the new tables have no representative rows.

## Code and verification status

- Added client/project routes under `src/app/(app)/clients` and `projects`, actions in `src/app/actions/clients-projects.ts`, Zod schemas in `src/lib/validations`, and shared record form UI.
- The failed operation was confirmed in Development Postgres logs as the `projects` INSERT. A reviewed migration now derives `created_by` from the database JWT in a BEFORE INSERT trigger, rather than trusting or comparing an app-supplied value in RLS. The action also checks its authenticated user matches the active membership.
- Follow-up app logs confirmed the signed-in user, organization membership, and JWT `sub` matched, but the insert call still reported an RLS error. Root cause was isolated with rollback-only Development checks: a plain Owner `INSERT` passes RLS, while the same `INSERT ... RETURNING id` fails. PostgREST's generated `INSERT ... RETURNING` also requires the new row to satisfy `projects_select_visible`; its `private.can_view_project` helper queries `projects` during the same statement, so the just-inserted row is not visible to that helper yet. Employee plain INSERT remains denied by the insert policy.
- Project creation now generates a UUID on the server and inserts without `RETURNING`, avoiding the unnecessary SELECT-policy evaluation. The database ID is then used for private project details and redirect. This is an application-code fix; no schema migration or live database change was needed. Lint/build pass after the change; one authenticated browser create and visibility check remains to confirm end-to-end behavior.
- Database errors exposed by client/project, organization creation, invitation creation, and invitation acceptance actions are mapped to safe user-facing copy; raw backend error strings are no longer passed through those actions.
- Sidebar navigation is active; dashboard client/project counts query persisted RLS-filtered records.
- `npm run lint` completed with the Next.js `next lint` deprecation notice.
- The first build exposed `never` inference on new generated table queries. A strict typed server-query surface based on local row/insert/update declarations resolved it; `npx tsc --noEmit` and `npm run build` now pass without `any` or compiler suppression.
- `npm run lint` passes with the existing Next.js `next lint` deprecation message. Prettier formatted the changed files. `npm run build` passed after rerunning outside the sandbox due to an initial Windows `spawn EPERM`.
- No test runner exists. No app-backed Phase 3 test, authorization matrix, or live cross-organization query test was completed. Existing owner-reported Phase 2 flows were not rerun; no test account credentials were available through the connected database tools.

## Continue safely

1. Use authenticated test accounts to verify client create/edit/search/archive, project status/client/visibility/member controls, and Owner/PM/Employee access including a second organization. Rerun auth, org creation, and invite acceptance/rejection/revocation/expiry flows.
2. If a schema fix is required, create and review another timestamped migration; never patch Development directly and never rewrite `first.sql`.
3. Update [TASK.md](./TASK.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and this file with actual check outcomes. Phase 4 is not started until the owner requests it.
