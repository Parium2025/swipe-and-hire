CREATE OR REPLACE FUNCTION public.create_team_invitation(p_inviter uuid,p_organization uuid,p_email text,p_role text,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_pending public.organization_invitations%ROWTYPE; v_inv public.organization_invitations%ROWTYPE; v_email text:=lower(trim(p_email));
BEGIN
 IF public.is_org_admin(p_inviter,p_organization) IS NOT TRUE THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_role NOT IN ('admin','recruiter') OR nullif(v_email,'') IS NULL OR length(p_token_hash)<>64 THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_organization::text||':'||v_email,0));
 SELECT * INTO v_pending FROM public.organization_invitations WHERE organization_id=p_organization AND lower(email)=v_email AND status='pending' FOR UPDATE;
 IF FOUND AND v_pending.expires_at>now() AND v_pending.created_at>now()-interval '10 seconds' THEN RETURN jsonb_build_object('code','in_progress'); END IF;
 UPDATE public.organization_invitations SET status=CASE WHEN expires_at<=now() THEN 'expired' ELSE 'revoked' END,updated_at=now() WHERE organization_id=p_organization AND lower(email)=v_email AND status='pending';
 INSERT INTO public.organization_invitations(organization_id,email,role,token_hash,invited_by,expires_at) VALUES(p_organization,v_email,p_role,p_token_hash,p_inviter,now()+interval '7 days') RETURNING * INTO v_inv;
 RETURN jsonb_build_object('invitation',jsonb_build_object('id',v_inv.id,'email',v_inv.email,'role',v_inv.role,'status',v_inv.status,'expires_at',v_inv.expires_at,'created_at',v_inv.created_at));
END;
$$;
REVOKE ALL ON FUNCTION public.create_team_invitation(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid,uuid,text,text,text) TO service_role;
COMMENT ON FUNCTION public.create_team_invitation(uuid,uuid,text,text,text) IS 'Atomic replacement; same-org/email lock and short duplicate suppression prevent races and repeated emails.';