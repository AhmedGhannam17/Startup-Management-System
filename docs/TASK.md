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

The owner-reported organization and invitation flows were not independently rerun with test accounts. Live grant, policy-role, function-ACL, fixed-search-path, and Supabase-advisor checks were executed after the migrations. See [ARCHITECTURE.md](./ARCHITECTURE.md) for results. Phase 3 remains **not started**; no client/project work has begun.

Remaining Phase 2 follow-ups are leaked-password protection in Supabase Auth, baseline-ledger reproducibility, and test coverage. The connected Supabase tool did not expose Auth settings controls.

## Phase 3 — Clients and projects

**Status: Not started**

- [ ] Design organization-scoped client and project schema, constraints, indexes, and RLS from the PRD.
- [ ] Implement client create/read/update/archive/search workflows.
- [ ] Implement projects, statuses/priorities/dates, client links, technical/internal fields, and assigned members.
- [ ] Define and implement organization-wide versus restricted project visibility and per-project permissions.

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
- [ ] Replace hard-coded client/project/revenue metrics with permission-filtered persisted data.
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
