CREATE OR REPLACE FUNCTION public.guard_company_review_reply()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  -- Only the security-definer reply function (runs as owner) may write reply columns.
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.employer_reply := NULL; NEW.employer_reply_at := NULL; NEW.employer_reply_by := NULL;
    ELSE
      NEW.employer_reply := OLD.employer_reply;
      NEW.employer_reply_at := OLD.employer_reply_at;
      NEW.employer_reply_by := OLD.employer_reply_by;
      -- A review can never be moved to another company by its author.
      NEW.company_id := OLD.company_id;
    END IF;
  END IF;
  RETURN NEW;
END $function$;