

## Backlog / Kommande features

### 🔴 Personliga möteslänkar per teammedlem
**Prioritet:** Hög — krävs för team med flera rekryterare

**Problem:** Just nu sparas bara en möteslänk per företag (i företagsprofilen). Om ett team har 20 medarbetare som alla bokar intervjuer behöver varje person sin egen möteslänk (Zoom, Meet, Teams etc.).

**Lösning:**
1. Lägg till fält `interview_video_link` och `interview_office_address` på varje teammedlems profil (profiles-tabellen har redan dessa fält)
2. I `BookInterviewDialog` — hämta länken från den **inloggade rekryterarens** profil istället för företagsprofilen
3. Fallback: om rekryteraren inte har en egen länk, använd företagets generella länk
4. I arbetsgivarens profilsida — lägg till UI för att varje teammedlem ska kunna spara sin egen möteslänk

**Berörda filer:**
- `src/components/BookInterviewDialog.tsx`
- `src/pages/employer/EmployerProfile.tsx` (eller settings)
- `src/pages/employer/CompanyProfile.tsx` (befintlig företagslänk blir fallback)

---

### Tidigare plan (arkiverad)

## Problem
The action buttons (Chatta, Boka möte, Ta bort) use `truncate` on their text labels, causing "Boka möte" to show as "Boka m..." on small screens. The user wants the full text always visible — it's okay if the buttons shrink, but no truncation.

## Solution
Remove `truncate` from all three button text spans and replace with `whitespace-nowrap text-[clamp(9px,2.5vw,14px)]` so the text shrinks fluidly on tiny screens instead of being cut off. This keeps all labels fully readable at any viewport width.

### File: `src/components/candidates/CandidateSlideProfileTab.tsx`

1. On all three action button `<span>` elements (lines 261, 270, ~279), replace `className="truncate"` with `className="whitespace-nowrap text-[clamp(9px,2.5vw,14px)]"`
2. This allows the font to scale down on the smallest screens rather than truncating

No other files need changes.
