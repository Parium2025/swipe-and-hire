# Project architecture rules

- Outreach template families are saved through one atomic database function, and per-channel lookup state must be reset each loop so one channel can never overwrite another.
- The structured interview invitation email is mandatory and separate from editable outreach automations; show it as locked instead of creating a duplicate email rule.
- Mobile shells keep a stable `100dvh` frame; Safari positions focused fields and browser-color strips never cover content.
- Text areas used in long employer forms have bounded height and internal scrolling so typing cannot move neighboring fields or the mobile shell.
- Mobile text inputs use 16px text and native Safari touch focus; never add pointer-driven focus or delayed field scrolling because either competes with keyboard placement.
- Keyboard-heavy employer pages use isolated inner scrolling; the mobile shell main stays fixed.
- Only standalone mode reserves mobile browser-chrome space; page shells own the sole spacer.
- Never render a top overlay in ordinary mobile Safari; only standalone mode owns one persistent safe-area strip and content offset, unchanged by keyboard state.
- When iOS closes its keyboard, release any residual form-field focus so a following scroll gesture cannot reopen it.
- Employer welcome setup drafts details and choices until confirmation; replay-account trials never write profile, preferences or media, and only valid meeting links become defaults.
- Employer welcome and profile verify storage saved each uncropped original alongside its crop, then reopen that original for edits; this prevents double cropping.
- Employer replies to reviews go only through the security-definer `reply_to_company_review` RPC (owner or same-org colleagues); reply lives in `company_reviews.employer_reply` and is exposed via `company_reviews_public` — never add a direct UPDATE policy for replies.
- Candidate skeletons use resolved server totals per user/list; never transient defaults.
- Org roles are only admin and recruiter (viewer removed). Recruiters are locked out of company-wide settings in UI and DB: outreach_templates/outreach_automations writes require owner or org admin (is_org_admin), CompanyProfile renders only interview settings for non-admins, and Billing + EmployerSettings template/flow sections show a locked notice.
- Company fields (name, logo, industry, size, address, website, description, socials, org number) belong to the organization: invitees inherit them on accept (`copy_org_company_fields_to_member`, `joined_via_invite`), admin edits sync to all members via trigger, and the welcome tunnel skips company steps for invitees; this keeps one company identity per org.
- Employer shells own the shared `employer-dark` autofill scope so browser autofill never paints white over dark fields.
