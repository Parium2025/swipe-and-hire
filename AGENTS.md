# Project architecture rules

- Render emails statically with encoding validation; async streaming corrupts UTF-8 at chunk boundaries.
- Fetch support senders separately by user_id; tickets reference auth.users, so profile joins fail.

- Save outreach template families atomically; reset per-channel lookup state per loop.
- Keep the structured interview invitation locked and separate from editable automations.
- Mobile shells stay `100dvh`; keyboard-heavy pages scroll internally; long employer text areas scroll inside bounded height; browser chrome never covers content.
- Mobile inputs use 16px and native Safari focus; no pointer focus or delayed scrolling; blur when the iOS keyboard closes.
- Standalone owns the persistent safe-area strip and offset; ordinary Safari has a zero-offset top overlay only on the landing-video route.
- Welcome drafts until confirmation; replay writes nothing; valid links only; row-locked first-save-wins; account signals/visible checks close stale guides across devices without reload.
- Store uncropped originals with crops; reopen originals for edits; media remove/restore uses synchronous guards against stale rapid taps.
- Review replies only use `reply_to_company_review`; never add a direct UPDATE policy.
- Shared review branding reads the trimmed public-profile RPC under its own cache key; full profile rows stay private. Colleagues may read only each other's current profile image via `can_view_colleague_profile_image`, never originals, CVs or videos.
- Upgrade candidate portraits to full size only after it decodes, so initials never flash.
- Reports: refresh team portraits on authorized profile-change signals, scope snapshots to user and organization, trust server job counts over locally added application events, and keep cached report data account-scoped.
- Resolve colleague history/ratings via authorized org-member RPC; list ratings stay account-scoped: user_roles SELECT exposes only caller; RLS cannot set display priority.
- Drop delayed account-scoped fetches after account switch/sign-out so they can't overwrite the new cache.
- Warm employer candidate media and job cards with the exact rendered transform and account-scoped cache key; otherwise prefetch misses or leaks across accounts.
- Candidate skeletons use per-user/list server totals.
- Org roles are admin/recruiter only; recruiters cannot change company-wide settings, templates, automations, billing or team administration.
- Company identity is shared; invitees inherit it, skip setup; chat updates live. Atomic accept/provision share a profile lock against duplicates/partial setup.
- Autofill keeps each field's own surface; never repaint it globally.
- Auth is isolated per tab; device limits are per account with two devices. Cross-tab auth events never replace another tab's account or reload it.
- Automatic boot recovery may reload once only; persistent failures settle on a stable error state instead of looping. Preserve loop/reload/boot guards and tests.
- The landing-video route alone owns browser chrome color `#626262`; preserve its bounded chrome-reload guard (max two reloads per 10 s per tab) and never change other routes with it.
- Chat: native scroll, page/virtualize at 300/80; subscribe to typing only on visible rows to keep large inboxes fast.
- Start internal 1:1 chats from the colleague roster, reusing existing threads, one per colleague.
- Candidate activity queries and cache are account-scoped (user+applicant key), warmed by the page and refreshed for current author profiles: instant cold-start logs and live avatars without cross-account leaks.
- The notification bell alone owns its account-scoped cache and refresh; keep last-known state through daily returns and avoid a second silent preloader, because competing writes hide older unread items.
- Aggregate employer question filters for active org members in an authenticated definer function; role-table visibility alone hides colleagues' questions from recruiters.
- Sync candidate membership, list caches and server counts across mutations and realtime so icons and totals agree; candidate moves go to the account-scoped bell, not toasts.
- Stage menus and stage creation read/write the active candidate list's stage settings; default stage keys repeat across lists.
- Rating writes update the shared organization-rating cache optimistically and refetch on app return; the shared latest rating outranks the row's own and realtime can drop in the background.
- Touch profile actions reuse row handlers and membership; text tooltips use cancellable holds, and stage menus clear previews.
- Employer job rows fetch `job_questions(count)` in the shared select; bump the jobs cache key when it changes.

- Restore the account-scoped JSON query snapshot synchronously at auth init and refetch silently, so cold starts skip skeletons.
- Employer counts and nav badges show the account+org's last confirmed values until live totals arrive, else cold starts flash.
- Job-closed outreach comes only from the enqueue_outreach_dispatch trigger, unique per publish round; a sweeper would bypass its exclusions.
