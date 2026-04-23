DO $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  SELECT id, email INTO v_user_id, v_email
  FROM auth.users
  WHERE lower(email) LIKE 'parium.ab@%' OR lower(email) LIKE 'parium%hotmail%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user matching parium.ab@hotmail.com found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin') THEN
    UPDATE public.user_roles SET is_active = true WHERE user_id = v_user_id AND role = 'admin';
  ELSE
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (v_user_id, 'admin', true);
  END IF;

  RAISE NOTICE 'Admin role granted to % (%)', v_email, v_user_id;
END $$;