CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_user_id uuid,p_email text,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_inv public.organization_invitations%ROWTYPE; v_role public.user_roles%ROWTYPE; v_name text;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.role IS DISTINCT FROM 'employer' THEN RETURN jsonb_build_object('error','Un compte employeur requis','code','profile_required'); END IF;
  SELECT * INTO v_inv FROM public.organization_invitations WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code','not_found'); END IF;
  IF nullif(lower(trim(p_email)),'') IS NULL OR lower(trim(p_email)) <> lower(v_inv.email) THEN RETURN jsonb_build_object('code','wrong_email'); END IF;
  SELECT name INTO v_name FROM public.organizations WHERE id=v_inv.organization_id;
  IF v_inv.status='accepted' THEN
    IF v_inv.accepted_by=p_user_id AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND organization_id=v_inv.organization_id AND is_active=true) THEN
      RETURN jsonb_build_object('success',true,'alreadyMember',true,'organizationName',v_name);
    END IF;
    RETURN jsonb_build_object('code','already_used');
  END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('code','revoked'); END IF;
  IF v_inv.expires_at <= now() THEN
    UPDATE public.organization_invitations SET status='expired' WHERE id=v_inv.id;
    RETURN jsonb_build_object('code','expired');
  END IF;
  IF v_inv.role NOT IN ('admin','recruiter') THEN RETURN jsonb_build_object('code','invalid_role'); END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND is_active=true AND organization_id IS NOT NULL AND organization_id<>v_inv.organization_id) THEN RETURN jsonb_build_object('code','other_org'); END IF;
  SELECT * INTO v_role FROM public.user_roles WHERE user_id=p_user_id AND organization_id=v_inv.organization_id ORDER BY is_active DESC,created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_role.is_active IS NOT TRUE THEN UPDATE public.user_roles SET role=v_inv.role,is_active=true,updated_at=now() WHERE id=v_role.id; END IF;
  ELSE
    INSERT INTO public.user_roles(user_id,organization_id,role,is_active) VALUES(p_user_id,v_inv.organization_id,v_inv.role,true);
  END IF;
  UPDATE public.profiles SET organization_id=v_inv.organization_id,joined_via_invite=true WHERE user_id=p_user_id;
  PERFORM public.copy_org_company_fields_to_member(p_user_id,v_inv.organization_id);
  UPDATE public.organization_invitations SET status='accepted',accepted_by=p_user_id,accepted_at=now(),updated_at=now() WHERE id=v_inv.id;
  RETURN jsonb_build_object('success',true,'organizationName',v_name,'role',v_inv.role);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_team_invitation(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.provision_confirmed_employer_workspace(p_user_id uuid,p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_org uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.role IS DISTINCT FROM 'employer' THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.organization_invitations WHERE lower(email)=lower(trim(p_email)) AND status='pending' AND expires_at>now()) THEN RETURN; END IF;
  INSERT INTO public.organizations(name) VALUES(coalesce(nullif(trim(v_profile.company_name),''),'Min organisation')) RETURNING id INTO v_org;
  INSERT INTO public.user_roles(user_id,organization_id,role,is_active) VALUES(p_user_id,v_org,'admin',true);
  UPDATE public.profiles SET organization_id=v_org WHERE user_id=p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.provision_confirmed_employer_workspace(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_confirmed_employer_workspace(uuid,text) TO service_role;
COMMENT ON FUNCTION public.accept_team_invitation(uuid,text,text) IS 'Service-only, caller verified by edge function; profile lock serializes different invitations and workspace provisioning, all membership/profile/claim writes commit together.';
COMMENT ON FUNCTION public.provision_confirmed_employer_workspace(uuid,text) IS 'Service-only, call only after verified email confirmation; row lock prevents duplicate workspaces.';