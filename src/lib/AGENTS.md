# Lib rules

- Synced local toasts keep `syncedId` until the bell loads the server copy; early removal makes the badge flicker 1-0-1.
- Toast sync re-checks local read state after insert and marks the server row read; a tap during insert otherwise resurrects the badge.
- Realtime INSERT only bumps unread when the row is new and unread; late events for already-loaded rows made the badge bounce.
