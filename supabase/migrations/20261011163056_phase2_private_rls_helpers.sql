-- Keep SECURITY DEFINER membership helpers out of the exposed Data API.
-- RLS policies can call them directly because authenticated has schema usage
-- and function execution rights; PostgREST does not expose the private schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_org_owner(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid() AND role = 'owner'
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'project_manager')
  );
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION private.is_org_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.is_org_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.is_org_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) OR private.is_org_member(id));

DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
CREATE POLICY "Owners can update their organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (private.is_org_owner(id))
  WITH CHECK (private.is_org_owner(id));

DROP POLICY IF EXISTS "Members can view organization members" ON public.organization_members;
CREATE POLICY "Members can view organization members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org owners can insert memberships" ON public.organization_members;
CREATE POLICY "Org owners can insert memberships" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      private.is_org_owner(organization_id) OR
      (
        user_id = (SELECT auth.uid()) AND role = 'owner'
        AND EXISTS (
          SELECT 1 FROM public.organizations
          WHERE id = organization_id AND created_by = (SELECT auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Owners can update member roles" ON public.organization_members;
CREATE POLICY "Owners can update member roles" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (private.is_org_owner(organization_id))
  WITH CHECK (private.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Owners or self can delete membership" ON public.organization_members;
CREATE POLICY "Owners or self can delete membership" ON public.organization_members
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Org members can view organization invitations" ON public.organization_invitations;
CREATE POLICY "Org members can view organization invitations" ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can create invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can create invitations" ON public.organization_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN role = 'owner' THEN private.is_org_owner(organization_id)
    ELSE private.is_org_admin(organization_id) END
  );

DROP POLICY IF EXISTS "Org admins can update/revoke invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can update/revoke invitations" ON public.organization_invitations
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN role = 'owner' THEN private.is_org_owner(organization_id)
    ELSE private.is_org_admin(organization_id) END
  )
  WITH CHECK (
    CASE WHEN role = 'owner' THEN private.is_org_owner(organization_id)
    ELSE private.is_org_admin(organization_id) END
  );

REVOKE ALL PRIVILEGES ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.is_org_member(uuid);
DROP FUNCTION public.is_org_owner(uuid);
DROP FUNCTION public.is_org_admin(uuid);
