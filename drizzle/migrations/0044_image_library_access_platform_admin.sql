CREATE OR REPLACE FUNCTION public.has_image_library_access(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'pariumab@hotmail.com') THEN RETURN true; END IF;
  IF public.is_platform_admin(_user_id) THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.get_active_plan_details(_user_id) p WHERE p.tier IN ('vaxa','pro'));
END $$;