-- Phase 3: organization-scoped clients and projects.
-- Sensitive client/project fields are split into separate RLS-protected
-- tables because row-level policies cannot restrict individual columns.

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  contact_name text CHECK (contact_name IS NULL OR length(contact_name) <= 160),
  email text CHECK (email IS NULL OR length(email) <= 254),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  address text CHECK (address IS NULL OR length(address) <= 500),
  website text CHECK (website IS NULL OR length(website) <= 2048),
  business_category text CHECK (business_category IS NULL OR length(business_category) <= 120),
  archived_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_organization_id_id_key UNIQUE (organization_id, id)
);

CREATE TABLE public.client_private_details (
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  tax_id text CHECK (tax_id IS NULL OR length(tax_id) <= 120),
  internal_notes text CHECK (internal_notes IS NULL OR length(internal_notes) <= 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, client_id),
  CONSTRAINT client_private_details_client_fkey
    FOREIGN KEY (organization_id, client_id)
    REFERENCES public.clients(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 180),
  description text CHECK (description IS NULL OR length(description) <= 10000),
  project_type text CHECK (project_type IS NULL OR length(project_type) <= 120),
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date date,
  deadline date,
  completed_at timestamptz,
  visibility text NOT NULL DEFAULT 'organization'
    CHECK (visibility IN ('organization', 'restricted')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_organization_id_id_key UNIQUE (organization_id, id),
  CONSTRAINT projects_organization_client_fkey
    FOREIGN KEY (organization_id, client_id)
    REFERENCES public.clients(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT projects_deadline_after_start CHECK (
    start_date IS NULL OR deadline IS NULL OR deadline >= start_date
  )
);

CREATE TABLE public.project_members (
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_project_manager boolean NOT NULL DEFAULT false,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_manage_members boolean NOT NULL DEFAULT false,
  can_manage_tasks boolean NOT NULL DEFAULT false,
  can_manage_milestones boolean NOT NULL DEFAULT false,
  can_edit_info boolean NOT NULL DEFAULT false,
  can_access_sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, project_id, user_id),
  CONSTRAINT project_members_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES public.projects(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT project_members_organization_member_fkey
    FOREIGN KEY (organization_id, user_id)
    REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE,
  CONSTRAINT project_manager_must_be_viewer CHECK (NOT is_project_manager OR can_view),
  CONSTRAINT project_permissions_require_visibility CHECK (
    can_view OR (
      NOT can_edit
      AND NOT can_manage_members
      AND NOT can_manage_tasks
      AND NOT can_manage_milestones
      AND NOT can_edit_info
      AND NOT can_access_sensitive
      AND NOT is_project_manager
    )
  )
);

CREATE UNIQUE INDEX project_members_one_manager_per_project
  ON public.project_members(organization_id, project_id)
  WHERE is_project_manager;

CREATE TABLE public.project_private_details (
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  project_value numeric(14, 2) CHECK (project_value IS NULL OR project_value >= 0),
  technology_stack text CHECK (technology_stack IS NULL OR length(technology_stack) <= 2000),
  repository_url text CHECK (repository_url IS NULL OR length(repository_url) <= 2048),
  live_url text CHECK (live_url IS NULL OR length(live_url) <= 2048),
  hosting_provider text CHECK (hosting_provider IS NULL OR length(hosting_provider) <= 240),
  deployment_information text CHECK (
    deployment_information IS NULL OR length(deployment_information) <= 5000
  ),
  technical_notes text CHECK (technical_notes IS NULL OR length(technical_notes) <= 10000),
  internal_notes text CHECK (internal_notes IS NULL OR length(internal_notes) <= 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, project_id),
  CONSTRAINT project_private_details_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES public.projects(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX clients_org_name_idx ON public.clients(organization_id, name);
CREATE INDEX clients_org_archive_idx ON public.clients(organization_id, archived_at);
CREATE INDEX projects_org_created_idx ON public.projects(organization_id, created_at DESC);
CREATE INDEX projects_org_status_idx ON public.projects(organization_id, status);
CREATE INDEX projects_org_priority_idx ON public.projects(organization_id, priority);
CREATE INDEX projects_org_client_idx ON public.projects(organization_id, client_id);
CREATE INDEX projects_org_visibility_idx ON public.projects(organization_id, visibility);
CREATE INDEX projects_org_deadline_idx ON public.projects(organization_id, deadline);
CREATE INDEX project_members_user_idx ON public.project_members(organization_id, user_id);

-- New public tables receive no implicit Data API access. The authenticated
-- grants below are the complete table-level privilege set for these workflows.
REVOKE ALL PRIVILEGES ON TABLE
  public.clients,
  public.client_private_details,
  public.projects,
  public.project_members,
  public.project_private_details
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_private_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_private_details TO authenticated;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_private_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_private_details ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.can_view_project(p_organization_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_org_member(p_organization_id)
    AND EXISTS (
      SELECT 1
      FROM public.projects AS p
      WHERE p.organization_id = p_organization_id
        AND p.id = p_project_id
        AND (
          private.is_org_owner(p_organization_id)
          OR p.visibility = 'organization'
          OR EXISTS (
            SELECT 1
            FROM public.project_members AS pm
            WHERE pm.organization_id = p.organization_id
              AND pm.project_id = p.id
              AND pm.user_id = auth.uid()
              AND pm.can_view
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_edit_project(p_organization_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_org_member(p_organization_id)
    AND (
      private.is_org_owner(p_organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.projects AS p
        WHERE p.organization_id = p_organization_id
          AND p.id = p_project_id
          AND EXISTS (
            SELECT 1
            FROM public.project_members AS pm
            WHERE pm.organization_id = p.organization_id
              AND pm.project_id = p.id
              AND pm.user_id = auth.uid()
              AND (pm.is_project_manager OR pm.can_edit)
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_project_members(
  p_organization_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_org_member(p_organization_id)
    AND (
      private.is_org_owner(p_organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.projects AS p
        WHERE p.organization_id = p_organization_id
          AND p.id = p_project_id
          AND (
            (
              p.created_by = auth.uid()
              AND private.is_org_admin(p_organization_id)
            )
            OR EXISTS (
              SELECT 1
              FROM public.project_members AS pm
              WHERE pm.organization_id = p.organization_id
                AND pm.project_id = p.id
                AND pm.user_id = auth.uid()
                AND (pm.is_project_manager OR pm.can_manage_members)
            )
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_access_project_sensitive(
  p_organization_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.can_view_project(p_organization_id, p_project_id)
    AND (
      private.is_org_owner(p_organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        WHERE pm.organization_id = p_organization_id
          AND pm.project_id = p_project_id
          AND pm.user_id = auth.uid()
          AND (pm.is_project_manager OR pm.can_access_sensitive)
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_edit_project_sensitive_info(
  p_organization_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.can_access_project_sensitive(p_organization_id, p_project_id)
    AND (
      private.is_org_owner(p_organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        WHERE pm.organization_id = p_organization_id
          AND pm.project_id = p_project_id
          AND pm.user_id = auth.uid()
          AND (pm.is_project_manager OR pm.can_edit_info)
      )
    );
$$;

REVOKE ALL PRIVILEGES ON FUNCTION private.can_view_project(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.can_edit_project(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.can_manage_project_members(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.can_access_project_sensitive(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.can_edit_project_sensitive_info(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_edit_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_project_members(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_project_sensitive(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_edit_project_sensitive_info(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_tenant_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Organization ownership cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_prevent_tenant_transfer
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION private.prevent_tenant_transfer();
CREATE TRIGGER client_private_details_prevent_tenant_transfer
  BEFORE UPDATE ON public.client_private_details
  FOR EACH ROW EXECUTE FUNCTION private.prevent_tenant_transfer();
CREATE TRIGGER projects_prevent_tenant_transfer
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.prevent_tenant_transfer();
CREATE TRIGGER project_members_prevent_tenant_transfer
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION private.prevent_tenant_transfer();
CREATE TRIGGER project_private_details_prevent_tenant_transfer
  BEFORE UPDATE ON public.project_private_details
  FOR EACH ROW EXECUTE FUNCTION private.prevent_tenant_transfer();

CREATE OR REPLACE FUNCTION private.guard_project_controls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Project creator cannot be changed';
  END IF;
  IF NEW.visibility IS DISTINCT FROM OLD.visibility
    AND NOT private.can_manage_project_members(OLD.organization_id, OLD.id) THEN
    RAISE EXCEPTION 'You do not have permission to change project visibility';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_guard_controls
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.guard_project_controls();

CREATE OR REPLACE FUNCTION private.set_project_completion_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_set_completion_timestamp
  BEFORE INSERT OR UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.set_project_completion_timestamp();

CREATE OR REPLACE FUNCTION private.validate_project_manager_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_project_manager AND NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS om
    WHERE om.organization_id = NEW.organization_id
      AND om.user_id = NEW.user_id
      AND om.role = 'project_manager'
  ) THEN
    RAISE EXCEPTION 'The assigned project manager must have the Project Manager organization role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_members_validate_manager
  BEFORE INSERT OR UPDATE OF organization_id, user_id, is_project_manager
  ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION private.validate_project_manager_membership();

REVOKE ALL PRIVILEGES ON FUNCTION private.prevent_tenant_transfer()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.guard_project_controls()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.set_project_completion_timestamp()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.validate_project_manager_membership()
  FROM PUBLIC, anon, authenticated;

CREATE POLICY clients_select_org_members ON public.clients
  FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));
CREATE POLICY clients_insert_org_admins ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_admin(organization_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY clients_update_org_admins ON public.clients
  FOR UPDATE TO authenticated
  USING (private.is_org_admin(organization_id))
  WITH CHECK (private.is_org_admin(organization_id));

CREATE POLICY client_private_details_select_org_admins ON public.client_private_details
  FOR SELECT TO authenticated
  USING (private.is_org_admin(organization_id));
CREATE POLICY client_private_details_insert_org_admins ON public.client_private_details
  FOR INSERT TO authenticated
  WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY client_private_details_update_org_admins ON public.client_private_details
  FOR UPDATE TO authenticated
  USING (private.is_org_admin(organization_id))
  WITH CHECK (private.is_org_admin(organization_id));

CREATE POLICY projects_select_visible ON public.projects
  FOR SELECT TO authenticated
  USING (private.can_view_project(organization_id, id));
CREATE POLICY projects_insert_org_admins ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_admin(organization_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY projects_update_editors ON public.projects
  FOR UPDATE TO authenticated
  USING (private.can_edit_project(organization_id, id))
  WITH CHECK (private.can_edit_project(organization_id, id));

CREATE POLICY project_members_select_visible ON public.project_members
  FOR SELECT TO authenticated
  USING (private.can_view_project(organization_id, project_id));
CREATE POLICY project_members_insert_managers ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_project_members(organization_id, project_id));
CREATE POLICY project_members_update_managers ON public.project_members
  FOR UPDATE TO authenticated
  USING (private.can_manage_project_members(organization_id, project_id))
  WITH CHECK (private.can_manage_project_members(organization_id, project_id));
CREATE POLICY project_members_delete_managers ON public.project_members
  FOR DELETE TO authenticated
  USING (private.can_manage_project_members(organization_id, project_id));

CREATE POLICY project_private_details_select_authorized ON public.project_private_details
  FOR SELECT TO authenticated
  USING (private.can_access_project_sensitive(organization_id, project_id));
CREATE POLICY project_private_details_insert_authorized ON public.project_private_details
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_edit_project_sensitive_info(organization_id, project_id)
  );
CREATE POLICY project_private_details_update_authorized ON public.project_private_details
  FOR UPDATE TO authenticated
  USING (private.can_edit_project_sensitive_info(organization_id, project_id))
  WITH CHECK (private.can_edit_project_sensitive_info(organization_id, project_id));
