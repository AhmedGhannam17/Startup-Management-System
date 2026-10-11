-- Phase 2 security hardening. This preserves the current data model and
-- invitation workflow while reducing API-role privileges to the minimum used
-- by the application.

-- API roles should not inherit anonymous table access. RLS remains the
-- row-level boundary for authenticated requests.
REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.organizations,
  public.organization_members,
  public.organization_invitations
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organization_invitations TO authenticated;

-- Make the intended API role explicit and preserve the existing predicates.
DROP POLICY IF EXISTS "Users can view own profile or org teammates profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or org teammates profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid()) OR EXISTS (
      SELECT 1
      FROM public.organization_members AS m1
      JOIN public.organization_members AS m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = (SELECT auth.uid())
        AND m2.user_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) OR public.is_org_member(id));

DROP POLICY IF EXISTS "Authenticated users can create an organization" ON public.organizations;
CREATE POLICY "Authenticated users can create an organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
CREATE POLICY "Owners can update their organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(id))
  WITH CHECK (public.is_org_owner(id));

DROP POLICY IF EXISTS "Members can view organization members" ON public.organization_members;
CREATE POLICY "Members can view organization members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org owners can insert memberships" ON public.organization_members;
CREATE POLICY "Org owners can insert memberships" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      public.is_org_owner(organization_id) OR
      (
        user_id = (SELECT auth.uid())
        AND role = 'owner'
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
  USING (public.is_org_owner(organization_id))
  WITH CHECK (public.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Owners or self can delete membership" ON public.organization_members;
CREATE POLICY "Owners or self can delete membership" ON public.organization_members
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Org members can view organization invitations" ON public.organization_invitations;
CREATE POLICY "Org members can view organization invitations" ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can create invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can create invitations" ON public.organization_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN role = 'owner' THEN public.is_org_owner(organization_id)
      ELSE public.is_org_admin(organization_id)
    END
  );

DROP POLICY IF EXISTS "Org admins can update/revoke invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can update/revoke invitations" ON public.organization_invitations
  FOR UPDATE TO authenticated
  USING (
    CASE
      WHEN role = 'owner' THEN public.is_org_owner(organization_id)
      ELSE public.is_org_admin(organization_id)
    END
  )
  WITH CHECK (
    CASE
      WHEN role = 'owner' THEN public.is_org_owner(organization_id)
      ELSE public.is_org_admin(organization_id)
    END
  );

-- An empty search_path prevents object-shadowing attacks. Every non-system
-- object referenced by these SECURITY DEFINER functions is schema-qualified.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.enforce_org_created_by() SET search_path = '';
ALTER FUNCTION public.is_org_member(uuid) SET search_path = '';
ALTER FUNCTION public.is_org_owner(uuid) SET search_path = '';
ALTER FUNCTION public.is_org_admin(uuid) SET search_path = '';
ALTER FUNCTION public.get_invitation_by_token(text) SET search_path = '';
ALTER FUNCTION public.accept_invitation(text) SET search_path = '';

-- PostgreSQL grants EXECUTE to PUBLIC by default. Remove that default exposure,
-- then grant only what the app's RLS and invitation pages require.
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_org_created_by() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
