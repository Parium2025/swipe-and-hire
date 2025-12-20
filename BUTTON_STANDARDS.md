# Button & Badge Standards Documentation

Senast uppdaterad: 2025-12-20

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

## Hover-isolering (Group Hover Pattern)

### Problem
När en förälder-rad (t.ex. `TableRow` eller `Card`) har hover-effekt (`hover:bg-white/10`) påverkas visuellt även barn-element med transparenta bakgrunder. Detta gör att glass-element ser "uttvättade" ut vid rad-hover.

### Lösning: Backdrop-brightness isolering
Använd `group` på föräldern och `group-hover:backdrop-brightness-90` på barn-elementen för att kompensera för förälderns hover-bakgrund. Sedan återställs ljusstyrkan vid direkt hover på elementet med `hover:backdrop-brightness-110`.

### Implementation

```tsx
// 1. Lägg till "group" på förälder-raden/kortet
<TableRow className="group hover:bg-white/10 ...">

// 2. På glass-element inuti raden, lägg till isolering:
<Badge 
  variant="glass" 
  className="transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-brightness-110"
>
  7 dagar kvar
</Badge>

<Button 
  variant="glass"
  className="transition-all duration-300 group-hover:backdrop-brightness-90 hover:backdrop-brightness-110"
>
  Ansök
</Button>
```

### Fullständigt mönster för olika element

#### Standard glass-badge med hover-isolering
```tsx
<Badge 
  variant="glass" 
  className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-blur-sm hover:backdrop-brightness-110"
>
  Deltid
</Badge>
```

#### Status-badge med färg och hover-isolering
```tsx
<Badge 
  variant="glass" 
  className="bg-green-500/20 text-green-300 border-green-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-green-500/30 hover:backdrop-brightness-110"
>
  Aktiv
</Badge>
```

#### Glass-knapp med hover-isolering
```tsx
<Button 
  variant="glass"
  size="sm"
  className="transition-all duration-300 group-hover:backdrop-brightness-90 hover:backdrop-brightness-110"
>
  Ansök
</Button>
```

#### Destructive ikon-knapp med hover-isolering
```tsx
<button
  className="inline-flex items-center justify-center rounded-full border h-8 w-8 bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 hover:backdrop-brightness-110 active:scale-95"
>
  <Trash2 className="h-4 w-4" />
</button>
```

### Filer med hover-isolering implementerad

| Fil | Element | Status |
|-----|---------|--------|
| `src/pages/SearchJobs.tsx` | Tid-badge, Deltid-badge, Ansök-knapp, Hjärta | ✅ |
| `src/pages/SavedJobs.tsx` | Tid-badge, Ta bort-knapp | ✅ |
| `src/pages/MyApplications.tsx` | Tid-badge, Status-badge | ✅ |
| `src/components/JobTitleCell.tsx` | Employment type badge | ✅ |
| `src/components/MobileJobCard.tsx` | Alla badges och knappar | ✅ |
| `src/components/ReadOnlyMobileJobCard.tsx` | Tid-badge, Hjärta, Employment type | ✅ |
| `src/components/CandidatesTable.tsx` | Status-badges | ✅ |
| `src/components/EmployerDashboard.tsx` | Status, Visningar, Ansökningar, Edit/Delete | ✅ |

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

## Checklista vid ny utveckling

- [ ] Använd `variant="glass"` för alla primära action-knappar och badges
- [ ] Använd `variant="outline"` för form-kontroller och dropdowns
- [ ] För manuell glass-styling: `bg-white/5 backdrop-blur-[2px]` (INTE `bg-white/10`)
- [ ] Hover: `hover:bg-white/15` (INTE `hover:bg-white/20`)
- [ ] Paneler/kort kan behålla `bg-white/10` för läsbarhet
- [ ] **Vid listor/tabeller med rad-hover**: Lägg till `group` på raden och `group-hover:backdrop-brightness-90 hover:backdrop-brightness-110` på glass-element
- [ ] Testa på både desktop och mobil
