# StartupHub — AI Development Rules

## 1. Source of Truth

StartupHub's product requirements are defined in:

`docs/prd.md`

Always read the PRD before implementing a new product feature.

The PRD defines what StartupHub is and what the finished product should provide.

Development prompts define what should be implemented at a particular point in development.

Do not modify the PRD simply because development is progressing from one feature to another.

---

## 2. Project

StartupHub is a SaaS-ready business management platform for digital agencies and small service-based businesses.

The product connects:

* Organizations
* Team members
* Clients
* Projects
* Tasks
* Milestones
* Quotations
* Payments
* Business information
* Activity and important records

The application should be built as a production-quality product, not as a temporary prototype.

---

## 3. Technical Foundation

The application uses:

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Row Level Security
* Zod
* ESLint
* Prettier
* Git
* GitHub

Use the current project conventions and stable versions appropriate for the application.

Do not introduce a different core framework or replace the planned stack without explicit approval.

---

## 4. Architecture

Use a modular monolith architecture.

Keep the application straightforward and maintainable.

Prefer clear separation between:

* UI
* Server-side application logic
* Data access
* Validation
* Authentication
* Authorization
* Shared utilities

Use Next.js server capabilities appropriately.

Do not introduce microservices or unnecessary infrastructure.

Do not create abstractions until they are actually useful.

---

## 5. TypeScript

Use TypeScript strictly.

Prefer explicit and meaningful types.

Do not use `any` as a shortcut.

Do not disable TypeScript checks to make code compile.

Do not use `@ts-ignore` or similar workarounds unless there is a genuine technical reason.

---

## 6. Security

Security is part of the application architecture.

Authentication and authorization must be enforced on the server.

Never rely on the UI alone for access control.

Never expose secrets or privileged credentials to the browser.

Never expose the Supabase service-role key to client-side code.

User input must be validated at appropriate server boundaries.

Organization data must remain isolated between organizations.

Database access should use appropriate Row Level Security policies.

Sensitive operations should respect the application's permission model.

---

## 7. Multi-Tenant Design

StartupHub is designed to support multiple organizations.

Do not design business data as if there will permanently be only one organization.

Where appropriate, records should belong to an organization.

Access to organization-owned data must be restricted to authorized members of that organization.

Do not create shortcuts that compromise future multi-tenant support.

---

## 8. Database

Use Supabase PostgreSQL.

When creating database structures:

* Use appropriate relationships.
* Use foreign keys where appropriate.
* Use constraints for data integrity.
* Use indexes where useful.
* Consider organization isolation.
* Use RLS for appropriate tables.
* Avoid storing redundant data without a reason.

Do not create database structures for functionality that has not been requested.

---

## 9. Validation

Use Zod where schema validation is appropriate.

Client-side validation improves user experience.

Server-side validation protects the application.

Do not trust client-provided values for authorization, permissions, ownership, or other security-sensitive decisions.

---

## 10. UI

Use the project's chosen UI stack and established design system.

The exact visual design should be decided during implementation based on the product requirements and context.

Prioritize:

* Usability
* Clarity
* Accessibility
* Responsiveness
* Consistency
* Professional appearance

Do not unnecessarily constrain the implementation to a predetermined visual design.

Use shadcn/ui where appropriate rather than creating unnecessary custom equivalents.

---

## 11. Code Quality

Prefer simple, readable code.

Avoid:

* Duplicate logic
* Giant components
* Giant server functions
* Dead code
* Unnecessary dependencies
* Premature abstractions
* Hardcoded business data
* Fake functionality
* Temporary hacks that become permanent

Keep business logic understandable.

---

## 12. Dependencies

Only add dependencies that are genuinely useful for the current implementation.

Do not install libraries simply because they might be useful in the future.

Prefer existing project capabilities when they are sufficient.

---

## 13. Environment Variables

Secrets must never be committed.

Use environment variables for configuration and credentials.

Maintain `.env.example` with variable names only.

Do not place real credentials in:

* Source code
* Git
* Documentation
* `.env.example`
* Client-side code

---

## 14. Git

The repository uses GitHub.

The primary development branch is:

`development`

`main` should remain stable.

Do not perform destructive Git operations such as:

* Force push
* History rewriting
* Resetting user work
* Deleting branches

unless explicitly instructed.

Do not commit secrets.

---

## 15. Product Scope

The PRD defines the overall StartupHub product.

A development task should implement only the functionality explicitly requested in that task.

Do not automatically implement every feature described in the PRD when working on one feature.

Do not invent major product functionality.

At the same time, do not modify or simplify the product requirements merely to make implementation easier.

---

## 16. Existing Work

Before modifying an existing implementation:

* Understand the current code.
* Reuse useful components and utilities.
* Preserve working functionality.
* Avoid unnecessary rewrites.

When the project is being initialized from scratch, establish a clean foundation instead of pretending that existing application code exists.

---

## 17. Documentation

Keep important project documentation under `docs/`.

Document meaningful architectural or setup decisions when they are useful for future development.

Do not create documentation solely for the sake of creating documentation.

The PRD remains the permanent product definition.

---

## 18. Implementation Judgment

Use reasonable engineering judgment.

Not every implementation decision needs to be approved beforehand.

Proceed independently when the decision:

* Fits the PRD
* Fits the existing architecture
* Does not introduce significant risk
* Does not change the product direction

Ask for clarification when a decision would materially change:

* Product behavior
* Data architecture
* Authentication model
* Authorization model
* Core technology
* External services
* Major business logic

---

## 19. Final Principle

Build StartupHub as if it will be used by real businesses.

Keep the implementation:

**Secure → Simple → Maintainable → Scalable → Practical**

The PRD defines the product.

The development prompt defines the current task.

Use engineering judgment to turn the requirements into a working product.
