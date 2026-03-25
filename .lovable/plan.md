

## Problem
The action buttons (Chatta, Boka möte, Ta bort) use `truncate` on their text labels, causing "Boka möte" to show as "Boka m..." on small screens. The user wants the full text always visible — it's okay if the buttons shrink, but no truncation.

## Solution
Remove `truncate` from all three button text spans and replace with `whitespace-nowrap text-[clamp(9px,2.5vw,14px)]` so the text shrinks fluidly on tiny screens instead of being cut off. This keeps all labels fully readable at any viewport width.

### File: `src/components/candidates/CandidateSlideProfileTab.tsx`

1. On all three action button `<span>` elements (lines 261, 270, ~279), replace `className="truncate"` with `className="whitespace-nowrap text-[clamp(9px,2.5vw,14px)]"`
2. This allows the font to scale down on the smallest screens rather than truncating

No other files need changes.

