# Component rules

- Touch-only TruncatedText is controlled only by the own tap and own outside-tap; ignore all Radix open/close requests (Safari emulated mouse/scroll events toggle it).
- TruncatedText measures clamp height with wrapping before the nowrap width check; multi-word one-line clamps hide line two with only ~1 px width overflow.
