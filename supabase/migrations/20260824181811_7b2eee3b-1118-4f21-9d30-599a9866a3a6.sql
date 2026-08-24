-- Stakeholder check for adding OTHER users to a conversation.
create or replace function public.can_add_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (
        -- Interna kollegachattar: samma organisation
        (
          c.kind = 'internal'
          and public.get_user_organization_id(p_user_id) is not null
          and public.get_user_organization_id(p_user_id) = public.get_user_organization_id(auth.uid())
        )
        -- Jobbchattar: kollega i samma organisation
        or (
          public.get_user_organization_id(p_user_id) is not null
          and public.get_user_organization_id(p_user_id) = public.get_user_organization_id(auth.uid())
        )
        -- Jobbchattar: kandidaten har sökt ett jobb som jag har rätt att se
        or exists (
          select 1
          from public.job_applications ja
          where ja.applicant_id = p_user_id
            and public.can_view_job_application(ja.job_id)
        )
        -- Kandidaten finns i mina kandidater
        or exists (
          select 1
          from public.my_candidates mc
          where mc.applicant_id = p_user_id
            and mc.recruiter_id = auth.uid()
        )
        -- Jag är kandidaten och lägger till arbetsgivaren för ett jobb jag sökt
        or exists (
          select 1
          from public.job_applications ja
          join public.job_postings jp on jp.id = ja.job_id
          where ja.applicant_id = auth.uid()
            and jp.employer_id = p_user_id
        )
      )
  );
$$;

grant execute on function public.can_add_conversation_member(uuid, uuid) to authenticated;

drop policy if exists "Conversation admins can add members" on public.conversation_members;

create policy "Conversation admins can add members"
on public.conversation_members
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.created_by = auth.uid()
    )
  )
  or (
    public.is_conversation_admin(conversation_id)
    and public.can_add_conversation_member(conversation_id, user_id)
  )
);