# Button Standards Documentation

Senast uppdaterad: 2025-12-19

## Designsystem för knappar

### Primära varianter

| Variant | Användning | Stil |
|---------|------------|------|
| `glass` | Action-knappar (CTA, spara, skicka) | Oval, glasmorfism, vit text |
| `outline` | Form-kontroller, dropdowns | Rektangulär, transparent med border |
| `ghost` | Sekundära actions, navigation | Ingen bakgrund, hover-effekt |
| `destructive` | Radera, ta bort | Röd färg för varning |

### Riktlinjer

- **Action-knappar**: Använd alltid `variant="glass"` för primära actions
- **Form-kontroller**: Använd `variant="outline"` för select-triggers och dropdowns
- **Ikon-knappar (destructive)**: Manuell styling med `text-destructive` och hover-effekter
- **Inverterade knappar**: Tillåtet för kontrast (t.ex. mobil-nav på mörk bakgrund)

---

## Granskade sidor och status

### ✅ Auth-sidor

| Fil | Status | Noteringar |
|-----|--------|------------|
| `src/pages/Auth.tsx` | ✅ Uppdaterad | Alla action-knappar använder `variant="glass"` |
| `src/components/AuthMobile.tsx` | ✅ Uppdaterad | "Spara nytt lösenord" använder `variant="glass"` |
| `src/components/AuthDesktop.tsx` | ✅ Uppdaterad | "Spara nytt lösenord" använder `variant="glass"` |

### ✅ Landing-sidor

| Fil | Status | Noteringar |
|-----|--------|------------|
| `src/pages/Landing.tsx` | ✅ Korrekt | CTA-kort använder manuell glass-styling (motion.div) |
| `src/components/LandingNav.tsx` | ✅ Uppdaterad | Desktop login-knapp använder `variant="glass"` |

### ✅ Employer Dashboard

| Fil | Status | Noteringar |
|-----|--------|------------|
| `src/components/EmployerDashboard.tsx` | ✅ Korrekt | Action-knappar använder `variant="glass"` |
| `src/components/EditJobDialog.tsx` | ✅ Korrekt | Spara/avbryt använder korrekta varianter |
| `src/components/CreateJobSimpleDialog.tsx` | ✅ Korrekt | Action-knappar använder `variant="glass"` |
| `src/components/CandidatesTable.tsx` | ✅ Korrekt | Pagination och ikon-knappar korrekt stylade |

### ✅ Employer Profile-sidor

| Fil | Status | Noteringar |
|-----|--------|------------|
| `src/pages/employer/EmployerProfile.tsx` | ✅ Uppdaterad | "Lägg till" för sociala medier använder `variant="glass"` |
| `src/pages/employer/CompanyProfile.tsx` | ✅ Korrekt | Spara-knapp använder `variant="glass"` |
| `src/pages/employer/EmployerSettings.tsx` | ✅ Korrekt | Action-knappar korrekt stylade |
| `src/pages/Billing.tsx` | ✅ Korrekt | Använder `variant="glass"` |

### ✅ Job Seeker-sidor

| Fil | Status | Noteringar |
|-----|--------|------------|
| `src/pages/Profile.tsx` | ✅ Korrekt | "Spara ändringar" använder `variant="glass"`, dropdowns använder `variant="outline"` |
| `src/pages/MyApplications.tsx` | ✅ Korrekt | Inga action-knappar att granska |
| `src/pages/SavedJobs.tsx` | ✅ Korrekt | "Sök jobb" använder `variant="glass"`, remove-knapp har manuell destructive-styling |

---

## Speciella fall

### Ikon-knappar med destructive action
```tsx
// Korrekt manuell styling för destructive ikon-knappar
<button
  className="text-destructive hover:text-destructive/80 transition-colors"
  onClick={handleDelete}
>
  <Trash2 className="h-4 w-4" />
</button>
```

### CTA-kort (Landing)
```tsx
// Korrekt manuell glass-styling för kort-komponenter
<motion.div
  className="bg-white/10 backdrop-blur-sm border border-white/20 text-white p-4 rounded-lg cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105"
>
  {/* content */}
</motion.div>
```

### Inverterade knappar (hög kontrast)
```tsx
// Tillåtet för mobil-nav på mörk bakgrund
<Button className="w-full bg-white text-primary hover:bg-white/90">
  Logga in
</Button>
```

---

## Checklista vid ny utveckling

- [ ] Använd `variant="glass"` för alla primära action-knappar
- [ ] Använd `variant="outline"` för form-kontroller och dropdowns
- [ ] Undvik manuella klasser som `text-white` på Button - använd variant istället
- [ ] Verifiera att destructive actions har tydlig visuell indikation
- [ ] Testa på både desktop och mobil
