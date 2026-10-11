-- Sensitive project fields are visible only to owners, assigned project
-- managers, and members with explicit sensitive-access permission.
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

REVOKE ALL PRIVILEGES ON FUNCTION private.can_access_project_sensitive(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.can_edit_project_sensitive_info(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_project_sensitive(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_edit_project_sensitive_info(uuid, uuid) TO authenticated;

CREATE INDEX clients_created_by_idx ON public.clients(created_by);
CREATE INDEX projects_created_by_idx ON public.projects(created_by);

CREATE OR REPLACE FUNCTION private.add_project_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.project_members (
    organization_id,
    project_id,
    user_id,
    can_view,
    can_edit,
    can_manage_members,
    can_edit_info,
    can_access_sensitive
  )
  VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.created_by,
    true,
    true,
    true,
    true,
    true
  );
  RETURN NEW;
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION private.add_project_creator_membership()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER projects_add_creator_membership
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.add_project_creator_membership();

CREATE OR REPLACE FUNCTION private.prevent_client_creator_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Client creator cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION private.prevent_client_creator_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER clients_prevent_creator_change
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION private.prevent_client_creator_change();
