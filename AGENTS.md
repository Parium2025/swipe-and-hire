# Project architecture rules

- Outreach template families are saved through one atomic database function, and per-channel lookup state must be reset each loop so one channel can never overwrite another.
- The structured interview invitation email is mandatory and separate from editable outreach automations; show it as locked instead of creating a duplicate email rule.
- Mobile shells keep a stable `100dvh` frame while the keyboard is open; `visualViewport` may only reveal focused fields inside existing scroll areas, and browser-color strips must never cover form content.
- Text areas used in long employer forms have bounded height and internal scrolling so typing cannot move neighboring fields or the mobile shell.
- Mobile text inputs follow the chat composer: 16px text and touch focus with `preventScroll`, then `visualViewport` reveals them inside the existing scroller.
- Mobile browser-chrome spacing has one owner: only standalone mode reserves bottom space, and page shells provide the sole spacer; never add global body or nested-scroll pseudo-element reserves.
- In ordinary iOS Safari the top color strip only paints browser chrome; only standalone mode reserves a top content offset, preventing double top bands.