# Project architecture rules

- Save outreach template families atomically; reset per-channel lookup state each loop.
- Keep the structured interview invitation locked and separate from editable automations.
- Mobile shells stay `100dvh`; keyboard-heavy pages scroll internally and browser chrome never covers content.
- Long employer text areas have bounded height and internal scrolling.
- Mobile inputs use 16px and native Safari focus; no pointer focus or delayed field scrolling.
- Only standalone mode owns one persistent safe-area strip and offset; ordinary Safari has no top overlay.
- Release residual field focus when the iOS keyboard closes.
- Employer welcome drafts until confirmation; replay trials write nothing; only valid meeting links become defaults.
- Store uncropped originals with crops and always reopen originals for edits.
- Review replies only use `reply_to_company_review`; never add a direct UPDATE policy.
- Candidate skeletons use resolved server totals per user/list.
- Org roles are admin/recruiter only; recruiters cannot change company-wide settings, templates, automations, billing or team administration.
- Company identity belongs to the organization; invitees inherit it and skip company welcome steps.
- Browser autofill keeps each field's own surface; never repaint it globally.
- Auth is isolated per tab; device limits are per account with three devices. Cross-tab auth events never replace another tab's account or reload it.
