-- StartupHub Phase 2 Database Schema & RLS Policies
-- Organization and Team Management Foundation

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (User Profiles synchronized with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. ORGANIZATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  business_description TEXT,
  tax_id TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_creator ON public.organizations(created_by);

-- Trigger to enforce created_by always equals the authenticated user.
-- This prevents a user from spoofing another user's ID as the creator.
CREATE OR REPLACE FUNCTION public.enforce_org_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_org_created_by ON public.organizations;
CREATE TRIGGER trg_enforce_org_created_by
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_created_by();

-- -----------------------------------------------------------------------------
-- 3. ORGANIZATION MEMBERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'project_manager', 'employee')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- -----------------------------------------------------------------------------
-- 4. ORGANIZATION INVITATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  recipient_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'project_manager', 'employee')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(organization_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);

-- -----------------------------------------------------------------------------
-- 5. HELPER SECURITY DEFINER FUNCTIONS (Prevents RLS Recursion)
-- -----------------------------------------------------------------------------

-- Check if current authenticated user is a member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if current authenticated user is an owner of an organization
CREATE OR REPLACE FUNCTION public.is_org_owner(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if current authenticated user is owner or project manager
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'project_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
DROP POLICY IF EXISTS "Users can view own profile or org teammates profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or org teammates profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.organization_members m1
      JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- --- ORGANIZATIONS POLICIES ---
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations
  FOR SELECT USING (
    created_by = (SELECT auth.uid()) OR public.is_org_member(id)
  );

DROP POLICY IF EXISTS "Authenticated users can create an organization" ON public.organizations;
CREATE POLICY "Authenticated users can create an organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
CREATE POLICY "Owners can update their organization" ON public.organizations
  FOR UPDATE USING (public.is_org_owner(id));

-- --- ORGANIZATION MEMBERS POLICIES ---
DROP POLICY IF EXISTS "Members can view organization members" ON public.organization_members;
CREATE POLICY "Members can view organization members" ON public.organization_members
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org owners can insert memberships" ON public.organization_members;
CREATE POLICY "Org owners can insert memberships" ON public.organization_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      public.is_org_owner(organization_id) OR
      (user_id = auth.uid() AND role = 'owner' AND EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND created_by = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can update member roles" ON public.organization_members;
CREATE POLICY "Owners can update member roles" ON public.organization_members
  FOR UPDATE USING (public.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Owners or self can delete membership" ON public.organization_members;
CREATE POLICY "Owners or self can delete membership" ON public.organization_members
  FOR DELETE USING (
    user_id = auth.uid() OR public.is_org_owner(organization_id)
  );

-- --- ORGANIZATION INVITATIONS POLICIES ---
DROP POLICY IF EXISTS "Org members can view organization invitations" ON public.organization_invitations;
CREATE POLICY "Org members can view organization invitations" ON public.organization_invitations
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can create invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can create invitations" ON public.organization_invitations
  FOR INSERT WITH CHECK (
    CASE
      WHEN role = 'owner' THEN public.is_org_owner(organization_id)
      ELSE public.is_org_admin(organization_id)
    END
  );

DROP POLICY IF EXISTS "Org admins can update/revoke invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can update/revoke invitations" ON public.organization_invitations
  FOR UPDATE
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

-- Function to allow public lookup of invitation details by token_hash during accept flow.
-- Returns only the fields needed by the invitation screen. Internal IDs are not exposed.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token_hash TEXT)
RETURNS TABLE (
  organization_name TEXT,
  email TEXT,
  recipient_name TEXT,
  role TEXT,
  status TEXT,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.name AS organization_name,
    i.email,
    i.recipient_name,
    i.role,
    i.status,
    (i.status = 'pending' AND i.expires_at > NOW()) AS is_valid
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 7. SECURE INVITATION ACCEPTANCE RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
  v_email_confirmed TIMESTAMPTZ;
BEGIN
  -- Get current user email and verification status
  SELECT email, email_confirmed_at
  INTO v_user_email, v_email_confirmed
  FROM auth.users WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF v_email_confirmed IS NULL THEN
    RAISE EXCEPTION 'You must verify your email address before accepting an invitation.';
  END IF;

  -- Lock the invitation row to prevent concurrent acceptance
  SELECT * INTO v_invitation
  FROM public.organization_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or missing invitation token';
  END IF;

  -- Reject expired invitations. Do not update status and then raise an
  -- exception in the same transaction, because the exception rolls back
  -- that status update. The lookup function independently reports expired
  -- pending invitations as invalid.
  IF v_invitation.status = 'pending' AND v_invitation.expires_at <= NOW() THEN
    RAISE EXCEPTION 'This invitation has expired.';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been %.', v_invitation.status;
  END IF;

  -- Case-insensitive email comparison
  IF LOWER(v_invitation.email) <> LOWER(v_user_email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address.';
  END IF;

  -- Check if user is already a member (idempotent guard)
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_invitation.organization_id
      AND user_id = auth.uid()
  ) THEN
    -- Mark invitation accepted even if already a member
    UPDATE public.organization_invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE id = v_invitation.id;
    RETURN v_invitation.organization_id;
  END IF;

  -- Insert member securely
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, auth.uid(), v_invitation.role);

  -- Mark invitation accepted
  UPDATE public.organization_invitations
  SET status = 'accepted', updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN v_invitation.organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
