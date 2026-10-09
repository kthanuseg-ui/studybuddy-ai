
-- StudyBuddy AI
-- Secure Admin Role Management
--
-- Allows administrators to change user roles
-- while preventing unauthorized changes.

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role public.user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  -- 1. Require an authenticated user.
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Serialize role changes.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    20261009, 1
  );

  -- 3. Verify the current user's Admin role.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_admin_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  -- 4. Validate the requested change.
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Invalid user ID or role';
  END IF;

  -- 5. Prevent Admins from changing
  -- their own role.
  IF p_user_id = v_admin_id THEN
    RAISE EXCEPTION 'You cannot change your own role'
      USING ERRCODE = '42501';
  END IF;

  -- 6. Update the selected user's role.
  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
END;
$$;

-- 7. Remove public function permissions.
REVOKE ALL ON FUNCTION public.admin_set_user_role(
  UUID,
  public.user_role
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_set_user_role(
  UUID,
  public.user_role
) FROM anon;

-- 8. Allow authenticated callers.
-- The function checks Admin permissions internally.
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(
  UUID,
  public.user_role
) TO authenticated;
