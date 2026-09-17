update public.profiles set company_name='Hoffstens Motor' where id='bfc5976f-9b46-4b2b-a6d6-ceaa222ba613' and coalesce(company_name,'')='';

create or replace function public.sync_organization_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is not null
     and coalesce(new.company_name,'') <> ''
     and coalesce(new.company_name,'') is distinct from coalesce(old.company_name,'') then
    update public.organizations
       set name = new.company_name
     where id = new.organization_id
       and name is distinct from new.company_name;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_org_name_from_profile on public.profiles;
create trigger sync_org_name_from_profile
after update of company_name on public.profiles
for each row execute function public.sync_organization_name_from_profile();