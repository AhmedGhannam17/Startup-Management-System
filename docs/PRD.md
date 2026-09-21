# StartupHub — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Approved for implementation  
**Product name:** StartupHub *(working name)*  
**Primary audience:** Digital agencies and small businesses  
**Initial deployment model:** Single organization per user, SaaS-ready architecture

---

## 1. Product Overview

StartupHub is a professional business-management platform initially designed for a digital agency. It centralizes project operations, team coordination, client records, quotations, manual payment tracking, and operational visibility in one secure workspace.

The V1 product will be built for the user's own agency first, while using an extensible multi-organization data model so that other agencies and small businesses can be supported later.

The product will not include a client portal in V1.

## 2. Product Goals

- Centralize agency operations in one workspace.
- Improve visibility into projects, tasks, milestones, deadlines, and payments.
- Provide controlled access to project and financial information.
- Produce professional, branded quotations.
- Maintain a reliable record of sensitive administrative actions.
- Establish a secure, maintainable foundation for future SaaS expansion.

## 3. Non-Goals for V1

The following are explicitly excluded from V1:

- Client portal or client login
- Online quotation acceptance
- Electronic signatures
- Automated quotation emailing
- Payment gateway integration
- Full accounting or bookkeeping functionality
- Complex tax-compliance engine
- Sales CRM or sales-pipeline management
- Complex Gantt charts
- Free-form quotation template editor
- Permanent storage of generated quotation files
- Microservice-based architecture

## 4. Technology Stack

- Next.js with App Router
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui
- Supabase Auth
- Supabase PostgreSQL
- PostgreSQL Row-Level Security (RLS)
- Supabase Storage where necessary
- Zod for validation
- ESLint and Prettier
- Git and GitHub

The application will initially use Next.js as a full-stack application. A separate backend service is not required for V1.

## 5. Organization Model

- The system will use organizations and organization memberships from the beginning.
- A user will initially belong to one organization.
- The schema must remain compatible with future multi-organization support.
- Every organization-owned record must be linked directly or indirectly to an organization.
- Organization-level access must be enforced through server-side authorization and PostgreSQL RLS.

## 6. Roles

Initial organization roles:

1. **Owner**
   - Full organization administration.
   - Manage members, invitations, roles, organization settings, and access.
   - Control project visibility and sensitive permissions.
   - Access financial and administrative information.

2. **Project Manager**
   - Access depends on organization and project permissions.
   - Does not automatically receive sensitive permissions solely because of the role.
   - May manage assigned projects, tasks, and milestones when granted access.

3. **Employee**
   - Access depends on organization membership and individual project permissions.
   - May work on assigned projects and tasks according to granted permissions.

Project Manager and Employee permissions must be configurable per project and per individual member.

## 7. Authentication and Onboarding

### Requirements

- Supabase Auth will manage authentication.
- Users must be able to register, log in, log out, and recover forgotten passwords.
- A new user must complete organization onboarding.
- A user profile will be associated with the Supabase Auth user ID.
- Organization creation and initial owner membership must be handled securely and transactionally.

### Invitations

The owner can create an invitation containing:

- Invitee name
- Invitee email
- Proposed role
- Organization
- Expiration date
- Invitation status

The system must:

- Store only a secure hash of the invitation token.
- Never expose raw invitation tokens in database records.
- Allow invitation revocation and expiration.
- Allow the invitee to activate their own authenticated account.
- Prevent unauthorized invitation acceptance.

## 8. Organization Profile and Branding

The organization can manage:

- Organization name
- Slug
- Logo
- Primary brand color
- Business email
- Phone number
- Address
- Website
- Tax or business details
- Default currency
- Default quotation terms
- Default payment terms

Branding will be used in professional quotation documents.

## 9. Team and Membership Management

The owner can:

- View organization members.
- Invite members.
- Assign or change organization roles.
- Suspend or remove members.
- Revoke pending invitations.
- View membership status.

Sensitive membership operations must be recorded in audit logs.

## 10. Project Management

### Project fields

A project may contain:

- Project name
- Description
- Client
- Project type
- Status
- Priority
- Start date
- Deadline
- Completion date
- Project manager
- Assigned members
- Project value
- Technology stack
- Repository URL
- Live URL
- Frontend provider
- Backend provider
- Database provider
- Deployment notes
- Internal notes
- Archived state
- Created by, updated by, and timestamps

### Statuses

- Planning
- In Progress
- On Hold
- Completed
- Cancelled

### Priorities

- Low
- Medium
- High
- Urgent

### Features

- Create, view, edit, archive, and manage projects.
- Search, filter, and sort projects.
- Assign project managers and members.
- Configure project visibility.
- Track project progress.
- Manage project milestones, tasks, notes, and deployment details.
- View project activity.

### Project visibility

Projects may be:

1. **Organization-wide:** visible to eligible organization members according to permission rules.
2. **Restricted:** visible only to explicitly assigned project members and authorized organization administrators.

Basic project visibility does not automatically grant access to sensitive information such as financial data or sensitive internal notes.

## 11. Project Permissions

Each project member can receive individual permissions.

Example permission keys:

- `view_project`
- `edit_project`
- `manage_tasks`
- `manage_milestones`
- `manage_members`
- `view_clients`
- `create_quotations`
- `view_payments`
- `manage_payments`
- `view_sensitive_notes`

Requirements:

- Permission keys must come from a central registry.
- Invalid permission keys must be rejected.
- Project access and financial access must remain separate.
- UI visibility must never be treated as a security boundary.
- Every protected mutation must perform server-side authorization.
- PostgreSQL RLS must enforce database-level access boundaries.

## 12. Tasks and Milestones

### Tasks

Each task may contain:

- Title
- Description
- Project
- Optional milestone
- Assignee
- Priority
- Status
- Due date
- Checklist items
- Notes or comments
- Created and updated timestamps

Task statuses:

- To Do
- In Progress
- Completed
- Blocked

### Milestones

Each milestone may contain:

- Name
- Description
- Project
- Due date
- Status
- Completion percentage
- Associated tasks

Complex Gantt functionality is excluded from V1.

## 13. Client Management

Client records may contain:

- Contact name
- Business name
- Email
- Phone
- Address
- Website
- Optional tax or business ID
- Category
- Internal notes
- Archive status
- Created and updated timestamps

Client functionality:

- Create, view, edit, archive, and search clients.
- Filter clients.
- Associate clients with projects, quotations, and payments.
- Keep client-profile access separate from basic project access.
- Require the appropriate `view_clients` or equivalent permission for full client details.

## 14. Quotations

### Purpose

The quotation module is for creating professional, branded quotation documents. It is not a sales pipeline or CRM.

### Quotation capabilities

Users with appropriate permissions can:

- Create quotations.
- Edit quotations.
- Save quotations.
- Reuse and duplicate quotations.
- Archive quotations.
- Delete quotations where authorized.
- Export quotations as PDF.
- Export quotations as an image.

Generated files will be created on demand and will not be permanently stored.

### Quotation fields

- Quotation number
- Client
- Optional project
- Issue date
- Valid-until date
- Title
- Description
- Line items
- Quantity
- Unit price
- Discount
- Tax
- Subtotal
- Total discount
- Total tax
- Grand total
- Currency
- Payment terms
- Terms and conditions
- Additional notes
- Signatory details
- Template key
- Created by
- Updated by
- Timestamps

### Line-item calculations

The system must calculate totals deterministically:

- Line-item amount
- Line-item discount
- Taxable amount
- Tax amount
- Subtotal
- Total discount
- Total tax
- Grand total

Currency and tax values must be explicit and configurable. V1 will not implement a complete tax-compliance engine.

### Templates

V1 will include 2–3 fixed professional templates, such as:

- Classic
- Modern
- Minimal

Templates will use organization branding. A free-form visual template editor is excluded.

### Numbering

Quotation numbers will use a database-backed year-based format:

`QUO-YYYY-NNNN`

Example:

`QUO-2026-0001`

The numbering mechanism must prevent duplicates under concurrent creation.

### Document generation

- Generate documents server-side.
- Use reusable rendering components.
- Do not permanently store generated files.
- Ensure generated output uses a consistent, canonical quotation representation.
- Evaluate PDF/image libraries for compatibility with the deployment runtime before final selection.

## 15. Manual Payment Tracking

The payment module is for operational record-keeping, not accounting.

### Payment fields

- Client
- Optional project
- Optional quotation
- Amount
- Currency
- Payment date
- Payment method
- Reference
- Notes
- Recorded by
- Created and updated timestamps

Payment methods:

- Cash
- Bank transfer
- UPI
- Card
- Other

### Features

- Record payments.
- Edit payments according to permissions.
- Delete payments according to permissions.
- Track received amounts.
- Calculate outstanding amounts.
- Support partial payments.
- Filter and search payment records.
- Display payment summaries on the dashboard.

Authorized deletion must create an audit-log entry. The design should allow a future migration to reversible void/archive behavior.

This module must not be represented as a full accounting system.

## 16. Audit Logs

Audit logs will initially cover sensitive actions only, including:

- Organization setting changes
- Invitations
- Role changes
- Member removal or suspension
- Project visibility changes
- Payment creation, editing, and deletion
- Quotation deletion
- Sensitive document actions

Each audit record should include:

- Organization ID
- Actor ID
- Action
- Entity type
- Entity ID
- Safe metadata
- Timestamp

Audit logs must never contain passwords, authentication tokens, service-role keys, or other secrets.

## 17. Dashboard

The dashboard must be permission-aware and may include:

- Active project count
- Project status breakdown
- Upcoming project deadlines
- Pending and overdue tasks
- Client count
- Total project value
- Received payment totals
- Outstanding amounts
- Recent activity
- Recently updated projects

Users must not see metrics or records they are not authorized to access.

## 18. Security Requirements

- Use Supabase Auth for authentication.
- Never expose a Supabase service-role key to the browser.
- Use server-side authorization for every protected operation.
- Use PostgreSQL RLS for database-level enforcement.
- Do not rely on hidden buttons or frontend checks for security.
- Validate all user-controlled input with Zod or equivalent schemas.
- Use centralized permission checks.
- Enforce organization boundaries on every organization-owned table.
- Use secure invitation-token hashing.
- Use safe, non-sensitive error messages.
- Avoid logging secrets or private business data.
- Apply database constraints and indexes where appropriate.
- Protect sensitive files and storage paths.
- Apply rate limiting where appropriate, especially to authentication and invitation-related flows.
- Keep development and production environments separate.

## 19. Data Model Overview

The planned database entities include:

- `profiles`
- `organizations`
- `organization_members`
- `organization_invitations`
- `clients`
- `projects`
- `project_members`
- `project_permissions`
- `milestones`
- `tasks`
- `task_checklist_items`
- `project_notes`
- `quotations`
- `quotation_items`
- `payments`
- `audit_logs`

An optional `quotation_snapshots` table may be introduced if immutable historical quotation values are required. Generated document files themselves will not be permanently stored.

Every organization-owned table must have a direct or validated relationship to its organization.

## 20. Recommended Application Architecture

Use a feature-oriented Next.js structure with clear separation of responsibilities:

- UI components for presentation
- Server Components for authorized reads
- Server Actions or Route Handlers for mutations and external boundaries
- Service/domain functions for business rules
- Zod schemas for validation
- Centralized authorization and permission utilities
- Dedicated Supabase server and browser clients
- Shared types and configuration modules

Avoid premature microservices. Keep the initial system as a modular monolith.

## 21. Non-Functional Requirements

### Security

The system must enforce tenant isolation, authorization, validation, and secure handling of credentials and sensitive records.

### Maintainability

Code should be modular, typed, documented where necessary, and easy for a solo developer to maintain.

### Extensibility

The data model and service boundaries should support future multi-organization usage and additional modules.

### Usability

The interface should be clean, professional, responsive, and consistent using shadcn/ui.

### Reliability

Critical operations such as membership changes, quotation numbering, payment changes, and permission changes must be transactional where appropriate.

### Performance

Use server-side data fetching where appropriate, indexed database queries, pagination for large lists, and avoid unnecessary client-side state.

## 22. Development Phases

1. Foundation, architecture, and environment setup
2. Authentication and onboarding
3. Organization profile and team management
4. Projects, visibility, and custom permissions
5. Tasks, milestones, notes, and deployment details
6. Client management
7. Quotations, templates, calculations, and exports
8. Payments and audit logs
9. Dashboard, navigation, UX polish, and access review
10. Production readiness and deployment

Each phase should include implementation, testing, security review, and manual verification before the next phase begins.

## 23. Acceptance Principles

A feature is not considered complete merely because its UI works. It must also have:

- Server-side authorization
- Appropriate RLS policies
- Input validation
- Error handling
- Loading and empty states
- Responsive UI
- Relevant tests
- Audit logging where required
- Protection against direct URL or request manipulation
- Documentation for important architectural decisions

## 24. Open Future Decisions

The following are intentionally deferred:

- Whether to introduce immutable quotation snapshots permanently
- Exact payment void/archive migration strategy
- Additional organization roles
- Advanced reporting and analytics
- External integrations
- Client portal
- Subscription and billing model for future SaaS release
- More advanced tax and compliance support

---

**Implementation status:** PRD approved for beginning technical implementation.
