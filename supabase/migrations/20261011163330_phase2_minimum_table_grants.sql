-- Remove the project's pre-existing broad authenticated grants and add only
-- table operations used by the Phase 2 app. RLS still limits rows per user.
REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.organizations,
  public.organization_members,
  public.organization_invitations
FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organization_invitations TO authenticated;
