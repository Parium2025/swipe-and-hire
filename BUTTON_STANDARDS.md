# Button & Badge Standards Documentation

Senast uppdaterad: 2025-12-19

## Designsystem - Glass-stil

### Ny Standard: Subtil Glass-effekt
Alla interaktiva glass-element använder nu en subtil stil som matchar "Deltid"-badgen:

```css
/* Default state - subtil */
bg-white/5 backdrop-blur-[2px] border-white/20

/* Hover state - starkare */
hover:bg-white/15 hover:backdrop-blur-sm hover:border-white/40
```

### Komponenter med glass-variant

| Komponent | Variant | Beskrivning |
|-----------|---------|-------------|
| `Button` | `variant="glass"` | Oval knapp med subtil glass-effekt |
| `Badge` | `variant="glass"` | Rund badge med subtil glass-effekt |

### Primära varianter

| Variant | Användning | Stil |
|---------|------------|------|
| `glass` | Action-knappar, badges, interaktiva element | Subtil bakgrund (5%), starkare på hover |
| `outline` | Form-kontroller, dropdowns | Rektangulär, transparent med border |
| `ghost` | Sekundära actions, navigation | Ingen bakgrund, hover-effekt |
| `destructive` | Radera, ta bort | Röd färg för varning |

---

## Viktiga riktlinjer

### ✅ Interaktiva element (använd bg-white/5)
- Knappar med default bakgrund
- Badges (employment type, countdown, status)
- Toggle-switchar
- Interaktiva kort (CTA)
- Ikon-knappar (edit, delete)

### ✅ Paneler/Kort (behåll bg-white/10)
- Card-komponenter
- AlertDialogContent
- Info-sektioner
- Formulär-bakgrunder
- Loading states

### ✅ Hover-only effekter (korrekt som de är)
- `hover:bg-white/10` eller `md:hover:bg-white/10`
- Visar endast effekt vid hover

---

## Uppdaterade filer

### Button-komponent
```tsx
// src/components/ui/button.tsx
glass: "rounded-full bg-white/5 backdrop-blur-[2px] border border-white/20 text-white md:hover:bg-white/15 md:hover:backdrop-blur-sm md:hover:border-white/50 active:scale-95 active:bg-white/20 transition-all duration-300"
```

### Badge-komponent
```tsx
// src/components/ui/badge.tsx
glass: "bg-white/5 backdrop-blur-[2px] border-white/20 text-white hover:bg-white/15 hover:backdrop-blur-sm hover:border-white/40"
```

---

## Granskade och uppdaterade filer

| Fil | Element | Status |
|-----|---------|--------|
| `src/components/ui/button.tsx` | glass variant | ✅ Uppdaterad |
| `src/components/ui/badge.tsx` | glass variant | ✅ Uppdaterad |
| `src/components/ui/sliding-tabs.tsx` | Toggle bakgrund | ✅ Uppdaterad |
| `src/components/JobTitleCell.tsx` | Deltid-badge | ✅ Uppdaterad |
| `src/components/TeamManagement.tsx` | Team badges | ✅ Uppdaterad |
| `src/components/EmployerDashboard.tsx` | Edit/Delete knappar | ✅ Uppdaterad |
| `src/components/SwipeDemo.tsx` | Matchningar badge | ✅ Uppdaterad |
| `src/components/CreateJobSimpleDialog.tsx` | Avbryt-knapp | ✅ Uppdaterad |
| `src/components/UnsavedChangesDialog.tsx` | Avbryt-knapp | ✅ Uppdaterad |
| `src/components/EditJobDialog.tsx` | Preview toggle | ✅ Uppdaterad |
| `src/components/MobileJobWizard.tsx` | Preview toggle | ✅ Uppdaterad |
| `src/pages/ProfilePreview.tsx` | View mode toggle | ✅ Uppdaterad |
| `src/pages/SavedJobs.tsx` | Soptunne-knapp | ✅ Uppdaterad |
| `src/pages/Landing.tsx` | CTA-kort | ✅ Uppdaterad |
| `src/pages/SearchJobs.tsx` | Ansök/hjärta | ✅ Använder variant |
| `src/pages/JobView.tsx` | Dagar kvar badge | ✅ Använder variant |
| `src/pages/MyApplications.tsx` | Dagar kvar badge | ✅ Använder variant |
| `src/components/ReadOnlyMobileJobCard.tsx` | Badges | ✅ Använder variant |

---

## Manuell styling för destructive ikon-knappar

```tsx
// Soptunna med destructive hover
<button
  className="inline-flex items-center justify-center rounded-full border h-8 w-8 bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 md:hover:bg-red-500/20 md:hover:border-red-500/40 md:hover:text-red-400 active:scale-95"
>
  <Trash2 className="h-4 w-4" />
</button>
```

---

## Checklista vid ny utveckling

- [ ] Använd `variant="glass"` för alla primära action-knappar och badges
- [ ] Använd `variant="outline"` för form-kontroller och dropdowns
- [ ] För manuell glass-styling: `bg-white/5 backdrop-blur-[2px]` (INTE `bg-white/10`)
- [ ] Hover: `hover:bg-white/15` (INTE `hover:bg-white/20`)
- [ ] Paneler/kort kan behålla `bg-white/10` för läsbarhet
- [ ] Testa på både desktop och mobil
