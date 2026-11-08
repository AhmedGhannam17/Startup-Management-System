-- Assign the project creator from the database-authenticated request. This
-- keeps creator identity out of client-supplied INSERT values while RLS still
-- restricts project creation to organization Owners and Project Managers.

CREATE OR REPLACE FUNCTION private.set_project_creator_from_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create a project'
      USING ERRCODE = '42501';
  END IF;

  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION private.set_project_creator_from_session()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS projects_set_creator_from_session ON public.projects;
CREATE TRIGGER projects_set_creator_from_session
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.set_project_creator_from_session();

DROP POLICY IF EXISTS projects_insert_org_admins ON public.projects;
CREATE POLICY projects_insert_org_admins ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (private.is_org_admin(organization_id));
