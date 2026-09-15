
create or replace function public.enforce_applicant_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only restrict when the caller is the applicant and not an employer with access to the job
  if auth.uid() is not null
     and auth.uid() = old.applicant_id
     and not public.can_view_job_application(old.job_id) then
    if (new.hidden_by_applicant_at is distinct from old.hidden_by_applicant_at) then
      null; -- allowed change
    end if;
    -- Rebuild the row with only allowed changes applied; everything else must stay unchanged
    if (to_jsonb(new) - 'hidden_by_applicant_at' - 'updated_at' - 'search_vector')
       is distinct from
       (to_jsonb(old) - 'hidden_by_applicant_at' - 'updated_at' - 'search_vector') then
      raise exception 'Du kan inte ändra den här informationen på din ansökan.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_applicant_application_update on public.job_applications;
create trigger enforce_applicant_application_update
before update on public.job_applications
for each row execute function public.enforce_applicant_application_update();

create or replace function public.enforce_applicant_interview_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.applicant_id
     and auth.uid() <> old.employer_id
     and not public.same_organization(auth.uid(), old.employer_id) then
    if new.status is distinct from old.status
       and new.status not in ('confirmed', 'declined') then
      raise exception 'Ogiltigt svar på intervjun.' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'status' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Du kan bara svara på intervjun, inte ändra dess innehåll.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_applicant_interview_update on public.interviews;
create trigger enforce_applicant_interview_update
before update on public.interviews
for each row execute function public.enforce_applicant_interview_update();
