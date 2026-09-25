# Project architecture rules

- Outreach template families are saved through one atomic database function, and per-channel lookup state must be reset each loop so one channel can never overwrite another.
- The structured interview invitation email is mandatory and separate from editable outreach automations; show it as locked instead of creating a duplicate email rule.
- Mobile shells keep a stable `100dvh` frame while the keyboard is open; `visualViewport` may only reveal focused fields inside existing scroll areas, and browser-color strips must never cover form content.