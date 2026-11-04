-- =====================================================
-- Migration 002: Secure Administrator Login RPC
-- Verifies credentials against Supabase Auth (auth.users),
-- validates public.admins authorization, and enforces the
-- strict 3-administrator account maximum.
-- =====================================================

CREATE OR REPLACE FUNCTION public.verify_admin_login(
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_admin_id UUID;
  v_role VARCHAR(50);
  v_is_active BOOLEAN;
  v_password_matches BOOLEAN;
  v_total_admins INT;
BEGIN
  -- 1. Check password in auth.users using extensions.crypt
  SELECT 
    id,
    (extensions.crypt(p_password, encrypted_password::text) = encrypted_password::text)
  INTO v_user_id, v_password_matches
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL OR v_password_matches IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid administrator credentials');
  END IF;

  -- 2. Check public.admins table
  SELECT id, role, is_active
  INTO v_admin_id, v_role, v_is_active
  FROM public.admins
  WHERE auth_user_id = v_user_id AND lower(email) = lower(p_email)
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access Denied: This account is not an authorized AWTMods administrator.');
  END IF;

  IF v_is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access Denied: This administrator account has been deactivated by the Superadmin.');
  END IF;

  -- 3. Verify Strict 3-Administrator Maximum
  SELECT COUNT(*) INTO v_total_admins FROM public.admins;
  IF v_total_admins > 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Security Policy Violation: More than 3 administrator accounts detected. Access blocked.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'admin', jsonb_build_object(
      'id', v_admin_id,
      'auth_user_id', v_user_id,
      'email', lower(p_email),
      'role', v_role
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_login(TEXT, TEXT) TO service_role, anon;

