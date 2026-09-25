# Project architecture rules

- Outreach template families are saved through one atomic database function, and per-channel lookup state must be reset each loop so one channel can never overwrite another.
- The structured interview invitation email is mandatory and separate from editable outreach automations; show it as locked instead of creating a duplicate email rule.
- Mobile shells keep a stable `100dvh` frame while the keyboard is open; `visualViewport` may only reveal focused fields inside existing scroll areas, and browser-color strips must never cover form content.
- Text areas used in long employer forms have bounded height and internal scrolling so typing cannot move neighboring fields or the mobile shell.
- Mobile text inputs use 16px text and gesture-aware touch focus: still taps focus with `preventScroll` after gesture resolution, while drags remain native scrolling; `visualViewport` only reveals the field inside the existing scroller.
- Keyboard-heavy employer pages use chat-style isolated inner scrolling; the mobile shell's structural main must stay non-scrolling on those routes.
- Mobile browser-chrome spacing has one owner: only standalone mode reserves bottom space, and page shells provide the sole spacer; never add global body or nested-scroll pseudo-element reserves.
- Never render a top overlay in ordinary mobile Safari; only standalone mode owns one persistent safe-area strip and content offset, unchanged by keyboard state.
- When iOS closes its keyboard, release any residual form-field focus so a following scroll gesture cannot reopen it.