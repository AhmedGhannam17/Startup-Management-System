# UpWeGo Project Memory

**Last reviewed:** 2026-10-11

## Handoff summary

Phase 2 organization and team flows were manually tested by the project owner. Their end-to-end flows were not rerun after hardening; lint, build, and live database security checks were run. Phase 3 remains unstarted. Read [PRD.md](./PRD.md) for product scope, [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture and current Supabase state, and [TASK.md](./TASK.md) for remaining setup.

## Durable decisions and constraints

- Product name is **UpWeGo**. The product requirements were renamed in place; their feature scope was not reduced or rewritten.
- Keep the planned stack: Next.js, React, TypeScript, Tailwind, shadcn-style UI, Supabase/PostgreSQL/Auth/RLS, and Zod.
- Keep a modular monolith. The current code uses App Router pages and server actions, with server actions calling Supabase directly. Add a separate service/repository layer only when real duplication or complexity justifies it.
- Treat the PRD as product authority and `TASK.md` as the delivery sequence. Do not start a later phase until requested.
- Enforce authentication and authorization on the server and in RLS. A selected organization cookie is a preference and must never be treated as proof of membership.
- For any schema or RLS change, create a new file under `supabase/migrations/` using `supabase migration new <descriptive_name>`; do not overwrite `first.sql`. Review it before applying to the intended development database, then confirm the recorded version and align the local filename.
- Never put service-role credentials in client code or `.env.example`. Current application code uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.
- Build a deliberate, accessible business UI that fits real workflows. Do not add decorative placeholder metrics or generic screens in place of working product behavior.

## Latest Supabase verification

- Three reviewed hardening migrations are applied to UpWeGo - Development: least-privilege table grants and authenticated policy roles, fixed function search paths and grants, and RLS helpers moved into a non-exposed `private` schema.
- Live checks confirm anon/PUBLIC have no grants on the four tables; authenticated has only Phase 2 operations. Trigger functions cannot be called through the API; intended invitation RPCs remain in public.
- The original baseline execution history cannot be proven. The three hardening migration filenames now match the remote ledger versions.
- `npm run lint` passed. `npm run build` passed after fixing a type error found in organization-switch membership validation. There is no automated test suite; owner-reported flows were not repeated.
- Organization switching verifies membership server-side. The active-organization cookie is HttpOnly/SameSite=Lax and Secure in production; legacy cookie values remain readable.
- Manual Phase 2 results are owner-reported; invitation links are shared manually and email delivery is not implemented.

## Handoff maintenance

After each meaningful feature, bug fix, or architectural change:

1. Update progress and outstanding work in `TASK.md`.
2. Update `ARCHITECTURE.md` if the actual structure, stack, data model, or security boundary changes.
3. Keep only durable decisions and the latest handoff point here; keep granular progress in `TASK.md`.
4. Keep `PRD.md` stable unless product requirements themselves are explicitly changed.
