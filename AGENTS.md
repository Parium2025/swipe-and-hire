# Project architecture rules

- Outreach template families are saved through one atomic database function, and per-channel lookup state must be reset each loop so one channel can never overwrite another.
- The structured interview invitation email is mandatory and separate from editable outreach automations; show it as locked instead of creating a duplicate email rule.
- Mobile shells follow `visualViewport` without transitions while the keyboard is open; browser-color strips must never cover focused form content.