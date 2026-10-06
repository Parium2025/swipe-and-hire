# Project architecture rules

- Render app emails statically and retain encoding validation; the legacy async renderer corrupts UTF-8 characters at stream chunk boundaries.
- Fetch support ticket sender names separately by user_id; support_tickets references auth.users rather than profiles, so embedded profile joins fail.

- Save outreach template families atomically; reset per-channel lookup state each loop.
- Keep the structured interview invitation locked and separate from editable automations.
- Mobile shells stay `100dvh`; keyboard-heavy pages scroll internally; long employer text areas scroll inside bounded height; browser chrome never covers content.
- Mobile inputs use 16px and native Safari focus; no pointer focus or delayed field scrolling; release residual field focus when the iOS keyboard closes.
- Standalone owns the persistent safe-area strip and offset; ordinary Safari has a zero-offset top overlay only on the landing-video route.
- Employer welcome drafts until confirmation; replay trials write nothing; only valid meeting links become defaults.
- Store uncropped originals with crops; reopen originals for edits; media remove/restore uses synchronous guards against stale rapid taps.
- Review replies only use `reply_to_company_review`; never add a direct UPDATE policy.
- Shared review branding reads the trimmed public-profile RPC under its own cache key; full profile rows stay private. Colleagues may read only each other's current profile image via `can_view_colleague_profile_image`, never originals, CVs or videos.
- Upgrade candidate portraits from thumbnail to full size only after the full image decodes, so initials never flash.
- Reports: refresh team portraits on authorized profile-change signals, scope snapshots to user and organization, trust server job counts over locally added application events, and keep cached report data account-scoped.
- Resolve colleague-owned candidate history and ratings through the authorized organization-member RPC; candidate-list ratings stay scoped to the signed-in account, because user_roles SELECT exposes only the caller and RLS alone does not set display priority.
- Ignore delayed account-scoped image and job-scope fetches after an account switch or sign-out so they cannot overwrite the new account's cache.
- Warm employer candidate media and job cards with the exact rendered transform and account-scoped cache key; otherwise prefetch misses or leaks across accounts.
- Candidate skeletons use server totals per user/list.
- Org roles are admin/recruiter only; recruiters cannot change company-wide settings, templates, automations, billing or team administration.
- Company identity is organizational; invitees inherit it, skip setup, and chat updates live.
- Browser autofill keeps each field's own surface; never repaint it globally.
- Auth is isolated per tab; device limits are per account with two devices. Cross-tab auth events never replace another tab's account or reload it.
- Automatic boot recovery may reload once only; persistent failures settle on a stable error state instead of looping. Preserve loop/reload/boot guards and tests.
- The landing-video route alone owns browser chrome color `#626262`; preserve its bounded chrome-reload guard (max two reloads per 10 s per tab) and never change other routes with it.
- Chat: native scroll, page/virtualize at 300/80; subscribe to typing only on visible rows to keep large inboxes fast.
- Start internal one-to-one chats from the colleague roster and reuse existing threads, so each colleague stays one discoverable entry.
- Candidate activity queries and cache are account-scoped (user+applicant key), warmed by the page and refreshed for current author profiles: instant cold-start logs and live avatars without cross-account leaks.
- The notification bell alone owns its account-scoped cache and refresh; keep last-known state through daily returns and avoid a second silent preloader, because competing writes hide older unread items.
- Aggregate employer question filters for active org members in an authenticated definer function; role-table visibility alone hides colleagues' questions from recruiters.
- Sync candidate membership, list caches and server counts across mutations and realtime so icons and totals agree.
- Stage menus and stage creation read/write the active candidate list's stage settings; default stage keys repeat across lists.
- Rating writes update the shared organization-rating cache optimistically and refetch on app return; the shared latest rating outranks the row's own and realtime can drop in the background.
- Candidate moves go to the account-scoped bell, not toasts.
- Touch profile list actions reuse row handlers and person membership.
- Employer job rows fetch `job_questions(count)` in the shared select; bump the jobs cache key when it changes, since stale snapshots lack the field.

- Restore the account-scoped plain-JSON query snapshot synchronously at auth init and refetch silently on first use, so cold starts skip skeletons.
- Employer count queries use the account's restored snapshot as placeholder until orgId hydrates, else cold starts show skeletons.
