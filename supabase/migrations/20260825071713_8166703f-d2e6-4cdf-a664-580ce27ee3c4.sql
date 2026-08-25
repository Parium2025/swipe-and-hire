-- Automatisk markering av genomförda intervjuer
create or replace function public.complete_past_interviews()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with upd as (
    update public.interviews
       set status = 'completed',
           updated_at = now()
     where status in ('pending', 'confirmed')
       and (scheduled_at + make_interval(mins => coalesce(duration_minutes, 60))) < (now() - interval '2 hours')
    returning 1
  )
  select count(*) into v_count from upd;
  return v_count;
end;
$$;

revoke all on function public.complete_past_interviews() from public, anon, authenticated;
grant execute on function public.complete_past_interviews() to service_role;