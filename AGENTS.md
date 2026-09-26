# Project architecture rules

- Outreach template families are saved through one atomic database function, and per-channel lookup state must be reset each loop so one channel can never overwrite another.
- The structured interview invitation email is mandatory and separate from editable outreach automations; show it as locked instead of creating a duplicate email rule.
- Mobile shells keep a stable `100dvh` frame while the keyboard is open; Safari alone positions focused fields, while `visualViewport` only tracks keyboard state and browser-color strips never cover form content.
- Text areas used in long employer forms have bounded height and internal scrolling so typing cannot move neighboring fields or the mobile shell.
- Mobile text inputs use 16px text and native Safari touch focus; never add pointer-driven focus or delayed field scrolling because either competes with keyboard placement.
- Keyboard-heavy employer pages use chat-style isolated inner scrolling; the mobile shell's structural main must stay non-scrolling on those routes.
- Mobile browser-chrome spacing has one owner: only standalone mode reserves bottom space, and page shells provide the sole spacer; never add global body or nested-scroll pseudo-element reserves.
- Never render a top overlay in ordinary mobile Safari; only standalone mode owns one persistent safe-area strip and content offset, unchanged by keyboard state.
- When iOS closes its keyboard, release any residual form-field focus so a following scroll gesture cannot reopen it.
- Employer welcome setup drafts company and personal details, meeting defaults and notification choices until final confirmation; replay-account trials never write real profile, preferences or media, and only validated meeting links become defaults.