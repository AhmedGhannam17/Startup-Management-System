# UpWeGo Implementation Tracker

This tracker separates code already present from the full product defined in [PRD.md](./PRD.md). “Implemented; verification pending” means the feature has corresponding repository code; it does not claim production readiness or a successful runtime check.

## Status key

- **Implemented; verification pending** — code exists; integration, edge cases, and production readiness still need explicit verification.
- **In progress** — work is underway and has an identified next action.
- **Not started** — no corresponding implementation was found in this repository inventory.
- **Blocked** — use only when external state or a decision prevents progress; record the blocker.

## Phase 0 — Repository and environment baseline

**Status: Implemented; verification pending**

- [x] Next.js App Router project, React, strict TypeScript, Tailwind, UI primitives, Supabase clients, ESLint, Prettier, npm lockfile.
- [x] Initial database migration for profiles, organizations, memberships, invitations, and RLS.
- [x] UpWeGo product identity applied to project-owned text, package metadata, and active-organization cookie key.
- [x] Add `.env.example` with the current app's required variable names only.
- [x] Run local app lint and production build.
- [ ] Confirm Supabase Auth redirects and account configuration in the developer's environment.
- [x] Establish a new-file migration workflow; three hardening migrations are applied and recorded in the connected development database.
- [ ] Resolve the original baseline's missing migration-ledger history before a clean reset or a fresh environment setup.

## Phase 1 — Accounts and authentication

**Status: Implemented; verification pending**

- [x] Email/password registration and login.
- [x] Password recovery and reset.
- [x] Supabase auth callback/session refresh.
- [ ] Verify email confirmation, recovery redirects, invalid/expired sessions, and safe redirect behavior against the configured Supabase project.
- [ ] Add automated coverage once a test strategy is selected.

## Phase 2 — Organizations and team access

**Status: Phase 2 workflows and database hardening complete; external Auth configuration and regression coverage remain**

- [x] Organization onboarding and profile settings.
- [x] Owner, project manager, and employee membership roles.
- [x] Team listing, role updates, member removal, and last-owner guards.
- [x] Hashed seven-day invitation tokens, restricted invitation lookup, and authenticated acceptance with email/expiry checks.
- [x] Organization RLS policies and membership helper functions for the current schema.
- [x] Owner-reported manual tests: organization creation/owner role, invitation persistence and acceptance, profile/membership creation, PM/Employee permissions, wrong-email/unverified rejection, reuse rejection, revocation, expiry, and relationship consistency.
- [x] Remove unnecessary anon/PUBLIC table privileges and limit authenticated table grants to the operations used by Phase 2.
- [x] Scope all RLS policies to authenticated users and make UPDATE new-row checks explicit.
- [x] Restrict function grants; internal membership helpers live in a private schema, invitation preview remains public, and acceptance requires authentication.
- [x] Set a fixed empty search_path on all Phase 2 SECURITY DEFINER functions.
- [x] Validate active organization switches against the signed-in user's membership and protect the preference cookie.
- [ ] Enable leaked-password protection in Supabase Auth.
- [ ] Review exact duplicate indexes and the unindexed invitation `invited_by` foreign key before changing indexes.
- [ ] Decide how member contact emails are safely exposed to authorized organization members.
- [ ] Add audit records for membership, role, invitation, and organization changes.
- [x] Invitation email is not sent; owner shares the generated link manually.
- [ ] Add automated regression tests; this repository currently has no test runner or test suite.

The owner-reported organization and invitation flows were not independently rerun with test accounts. Live grant, policy-role, function-ACL, fixed-search-path, and Supabase-advisor checks were executed after the migrations. See [ARCHITECTURE.md](./ARCHITECTURE.md) for results. Phase 3 implementation is tracked below.

Remaining Phase 2 follow-ups are leaked-password protection in Supabase Auth, baseline-ledger reproducibility, and test coverage. The connected Supabase tool did not expose Auth settings controls.

## Phase 3 — Clients and projects

**Status: Implemented; verification incomplete**

- [x] Add organization-scoped clients and projects, private-detail tables, project membership permissions, composite tenant foreign keys, checks, and query indexes through incremental migrations.
- [x] Apply both Phase 3 migrations to UpWeGo - Development; preserve `first.sql` and existing rows.
- [x] Implement client creation, listing, detail, edit, archive/restore, name search, and category/archive filters. Restrict client tax IDs and internal notes to Owners and Project Managers.
- [x] Implement project creation, listing, detail, editing, status, priority, dates, client association, technical/internal details, visibility, and member permission assignment.
- [x] Enforce organization-wide/restricted project visibility and sensitive-detail access in RLS, with matching server-side action checks.
- [x] Use persisted client/project counts for dashboard metrics and enable their navigation routes.
- [x] Add a typed server-query surface for the new table declarations and pass TypeScript/build checks without `any` or compiler suppressions.
- [ ] Exercise create/edit/archive/project assignment flows and owner/PM/employee/cross-organization boundaries using authenticated test accounts.
- [ ] Rerun the existing Phase 1/2 authentication, organization, and invitation flows using test accounts.
- [ ] Add automated regression tests when the repository test runner is selected.

**Verification to date:** migrations are recorded in the Development migration ledger, all nine public tables have RLS enabled, Phase 3 policy roles were checked, and security/performance advisors were reviewed. `npx tsc --noEmit`, `npm run build`, `npm run lint`, and Prettier formatting checks completed successfully (lint emits the existing Next.js `next lint` deprecation notice). No app-backed end-to-end Phase 3 flow, live cross-organization access assertion, or Phase 1/2 account flow was run in this turn. Do not treat Phase 3 as release ready until the open integration checks pass.

## Phase 4 — Tasks and milestones

**Status: Not started**

- [ ] Add milestones and tasks with organization/project ownership, status, priority, assignee, and due dates.
- [ ] Add task checklists, progress calculation, and project notes as specified by the PRD.
- [ ] Enforce access through server checks and RLS; verify relationships and deletion behavior.
- [ ] Add focused workflows for task assignment, status updates, overdue work, and milestone progress.

## Phase 5 — Quotations and payment records

**Status: Not started**

- [ ] Model quotations and line items with safe concurrent `QUO-YYYY-NNNN` numbering.
- [ ] Implement quote calculations, reusable templates, organization branding, and professional PDF output.
- [ ] Model manual payments linked to clients and optional projects/quotations.
- [ ] Implement payment permissions and traceable edits/deletes; derive received and outstanding totals from persisted records.

## Phase 6 — Operational overview and cross-cutting workflows

**Status: In progress (dashboard shell only)**

- [x] Dashboard shell with organization and team-member count.
- [x] Replace client/project metrics with persisted, RLS-filtered data. Revenue remains a Phase 5 placeholder.
- [ ] Add relevant project/task deadlines and recent activity.
- [ ] Add search and filtering across implemented business modules.
- [ ] Add notifications/reminders after the related business events and delivery approach are defined.
- [ ] Add audit log schema, policies, and event recording for sensitive operations.

## Phase 7 — Production readiness

**Status: Not started**

- [ ] Add automated unit/integration coverage for validation, authorization, invitations, tenant isolation, and financial calculations.
- [ ] Add CI checks for formatting, linting, type checking, tests, and build.
- [ ] Review responsive behavior, keyboard access, accessible names, loading/empty/error states, and usability with realistic business data.
- [ ] Review database migration process, backups, storage access policies, rate limiting, logging, and recovery procedures.
- [ ] Verify deployment settings, auth redirect allowlists, secrets, and monitoring in the chosen hosting environment.

## Update rule

After a feature, fix, or substantial design change, update this file's phase status and checklist. Update [ARCHITECTURE.md](./ARCHITECTURE.md) when the implemented structure, stack, schema, environment, or security boundary changes, and update [MEMORY.md](./MEMORY.md) with durable decisions and the current handoff point. Keep the PRD as the product authority; do not rewrite its scope to match implementation progress.
