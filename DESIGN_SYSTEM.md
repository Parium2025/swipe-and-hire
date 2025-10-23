# Parium Design System

Detta dokument innehåller standardmallar och riktlinjer för att hålla designen konsekvent i hela appen.

## Kort (Cards)

### Card-komponenter (Stats, Listor, Tabeller)

**Stats-kort:**
```tsx
<Card className="bg-white/5 backdrop-blur-sm border-white/20">
  <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-6 md:p-4">
    <Icon className="h-4 w-4 text-white" />
    <CardTitle className="text-sm font-medium text-white">Titel</CardTitle>
  </CardHeader>
  <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
    <div className="text-xl font-bold text-white">
      {/* Content */}
    </div>
  </CardContent>
</Card>
```

**Tabell-kort:**
```tsx
<Card className="bg-white/5 backdrop-blur-sm border-white/20">
  <CardHeader className="p-6 md:p-4">
    <CardTitle className="text-sm text-white">Titel</CardTitle>
  </CardHeader>
  <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
    {/* Table content */}
  </CardContent>
</Card>
```

### Div-baserade kort (Formulär, Profiler)

**Huvudkort med formulär:**
```tsx
<div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
  <form className="space-y-5 md:space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
      <div className="space-y-1.5">
        <Label className="text-white">Label</Label>
        <Input className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9" />
      </div>
    </div>
  </form>
</div>
```

**Informationskort:**
```tsx
<div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
  {/* Content */}
</div>
```

## Spacing-regler

### Kort-padding
- **Desktop:** `p-6` (24px)
- **Tablet/Mobile:** `md:p-4` (16px)
- För CardContent: `px-6 pb-6 md:px-4 md:pb-4`

### Formulär-spacing
- **Mellan fält:** `space-y-5 md:space-y-3`
- **Grid gap:** `gap-4 md:gap-3`
- **Label-till-input:** `space-y-1.5`

### Layout-spacing
- **Mellan sektioner:** `space-y-8`
- **Mellan kort:** `space-y-6`
- **Container max-width:** `max-w-4xl` (formulär) eller `max-w-6xl` (tabeller/dashboard)

## Färger och tokens

### Använd alltid semantiska tokens
```tsx
// ✅ RÄTT - Använd design tokens
<div className="bg-white/5 text-white border-white/10">

// ❌ FEL - Använd inte direkta färger
<div className="bg-gray-800 text-gray-100 border-gray-700">
```

### Kort-färger
- **Bakgrund:** `bg-white/5` med `backdrop-blur-sm`
- **Border:** `border-white/10` eller `border-white/20` (för mer framträdande kort)
- **Text:** `text-white` (primär), `text-white/70` (sekundär), `text-white/40` (placeholder)

## Input-komponenter

### Standard input
```tsx
<Input 
  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9"
  placeholder="Placeholder text"
/>
```

### Textarea
```tsx
<Textarea 
  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
  rows={3}
/>
```

### Select
```tsx
<Select>
  <SelectTrigger className="bg-white/5 border-white/10 text-white h-9">
    <SelectValue placeholder="Välj..." />
  </SelectTrigger>
  <SelectContent className="bg-slate-800/95 backdrop-blur-md border-slate-600/30">
    {/* Options */}
  </SelectContent>
</Select>
```

## Knappar

### Primär knapp
```tsx
<Button className="bg-primary/80 hover:bg-primary text-white border border-white/30">
  Spara
</Button>
```

### Sekundär knapp (outline)
```tsx
<Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
  Avbryt
</Button>
```

## Responsivitet

### Grid-layouts
```tsx
// 2 kolumner på desktop, 1 på mobile
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3 3xl:fluid-gap-4">

// 4 kolumner stats
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
```

### Padding/margin breakpoints
- Använd `md:` prefix för tablet/desktop
- Använd `3xl:` prefix för extra-stora skärmar (TV, Chromecast, 4K+)
- Standard är mobile-first

### Fluid Scaling för Extra-Large Screens (1920px+)

För skärmar över 1920px (TV, Chromecast, 4K) lägg till fluid-klasser:

**Stats-kort med fluid scaling:**
```tsx
<Card className="bg-white/5 backdrop-blur-sm border-white/20">
  <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-6 md:p-4 3xl:fluid-p-6">
    <Icon className="h-4 w-4 text-white" />
    <CardTitle className="text-sm md:text-base 3xl:fluid-text-base text-white">Titel</CardTitle>
  </CardHeader>
  <CardContent className="px-6 pb-6 md:px-4 md:pb-4 3xl:fluid-px-6 3xl:fluid-py-6">
    <div className="text-xl font-bold 3xl:fluid-text-2xl text-white">
      {/* Content */}
    </div>
  </CardContent>
</Card>
```

**Formulär med fluid scaling:**
```tsx
<div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4 3xl:fluid-p-6">
  <form className="space-y-5 md:space-y-3 3xl:fluid-space-y-5">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3 3xl:fluid-gap-4">
      <div className="space-y-1.5">
        <Label className="text-white text-sm 3xl:fluid-text-base">Label</Label>
        <Input className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-9 3xl:fluid-text-base" />
      </div>
    </div>
  </form>
</div>
```

**Tillgängliga fluid-klasser:**
- **Text:** `.fluid-text-xs`, `.fluid-text-sm`, `.fluid-text-base`, `.fluid-text-lg`, `.fluid-text-xl`, `.fluid-text-2xl`
- **Padding:** `.fluid-p-4`, `.fluid-p-6`, `.fluid-px-4`, `.fluid-px-6`, `.fluid-py-4`, `.fluid-py-6`
- **Spacing:** `.fluid-gap-3`, `.fluid-gap-4`, `.fluid-space-y-3`, `.fluid-space-y-5`

**Viktigt:**
- Desktop-versionen (upp till 1920px) påverkas INTE
- Fluid scaling aktiveras endast på skärmar över 1920px bredd
- Använd `3xl:` prefix för alla fluid-klasser

## Mobile-First Design Patterns (<768px)

### Grundprinciper

1. **Padding:** Mobile MINDRE än desktop (`p-4 md:p-6`)
2. **Touch targets:** Minimum 44x44px för alla interaktiva element
3. **Spacing:** Kompakt på mobil (`gap-3 md:gap-4`, `space-y-3 md:space-y-4`)
4. **Typography:** Samma storlek eller större, mer kontrast
5. **Layout:** Mer vertikalt fokuserad, mindre whitespace

### Touch-optimerade komponenter

**Knappar:**
```tsx
<Button className="w-full min-h-[44px] bg-primary hover:bg-primary/90">
  Klicka här
</Button>
```

**Input-fält:**
```tsx
<Input className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 sm:h-9" />
```

**Select/Dropdown triggers:**
```tsx
<Button variant="outline" className="w-full min-h-[44px] justify-between">
  <span>Välj alternativ</span>
  <ChevronDown className="h-5 w-5" />
</Button>
```

### Mobile-optimerade kort

**Kompakt Card:**
```tsx
<Card className="bg-white/5 backdrop-blur-sm border-white/20">
  <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 md:p-6">
    <Icon className="h-5 w-5" />
    <CardTitle className="text-base md:text-lg text-white">Titel</CardTitle>
  </CardHeader>
  <CardContent className="px-4 pb-4 md:px-6 md:pb-6 space-y-3 md:space-y-5">
    {/* Content */}
  </CardContent>
</Card>
```

**Kompakt formulär:**
```tsx
<form className="space-y-3 md:space-y-4">
  <div className="grid grid-cols-2 gap-2 md:gap-3">
    <div>
      <Label className="text-white text-sm">Label</Label>
      <Input className="bg-white/5 border-white/10 text-white h-11 sm:h-9" />
    </div>
  </div>
</form>
```

### Touch Target Guidelines

- **Minimum storlek:** 44x44px (iOS HIG standard)
- **Mellanrum:** 8px mellan interaktiva element
- **Expandera touch-area:** Använd padding för små ikoner
```tsx
<button className="p-3 -m-3"> {/* Expanderar touch utan visuell ändring */}
  <Icon className="h-4 w-4" />
</button>
```

### Mobile Typography

```tsx
// Rubriker - mer prominent på mobil
<h1 className="text-xl md:text-2xl"> {/* 20px mobil, 24px desktop */}
<h2 className="text-lg md:text-xl">  {/* 18px mobil, 20px desktop */}

// Body text - optimal läsbarhet
<p className="text-sm md:text-base"> {/* 14px mobil, 16px desktop */}

// Micro copy - spara utrymme
<span className="text-xs md:text-sm"> {/* 12px mobil, 14px desktop */}
```

## Mobile-First Typography Scale

### Headings
- **H1**: `text-xl md:text-2xl` (20px → 24px)
- **H2**: `text-lg md:text-xl` (18px → 20px)
- **H3**: `text-base md:text-lg` (16px → 18px)

### Body Text
- **Standard**: `text-sm md:text-base` (14px → 16px)
- **Compact**: `text-xs md:text-sm` (12px → 14px)

### Inputs
- **Standard**: `h-10 md:h-11` (40px → 44px)
- **Small forms**: `h-9 md:h-10` (36px → 40px)
- **Input text**: `text-base md:text-lg` with `py-2 md:py-3`

## Container Padding Hierarchy

### Side Padding
- **Main container**: `px-3 md:px-12` (12px → 48px)
- **Card outer**: `p-3 md:p-6` (12px → 24px)
- **Card inner/compact**: `p-2 md:p-4` (8px → 16px)

### Vertical Spacing
- **Between sections**: `space-y-3 md:space-y-6` (12px → 24px)
- **Between elements**: `space-y-2 md:space-y-4` (8px → 16px)
- **Compact**: `space-y-1 md:space-y-2` (4px → 8px)

### Grid Gaps
- **Standard**: `gap-2 md:gap-4` (8px → 16px)
- **Compact**: `gap-1.5 md:gap-2` (6px → 8px)

## Viktiga principer

1. **Alltid `backdrop-blur-sm`** på kort för djup och konsistens
2. **Mobile-first padding:** Start small on mobile, increase on larger screens
3. **Använd semantiska tokens** - inga hårdkodade färger
4. **Konsekvent spacing** - följ mobile-first patterns (ovan)
5. **Touch-optimerat:** Minimum 44px höjd på alla knappar och interaktiva element
6. **Responsive design** - mobile-first approach med progressiv förbättring
7. **Mobile-first typography**: Använd responsiva textstorlekar (t.ex. `text-xs md:text-sm`)
8. **Kompakta mobile layouts**: Minska whitespace på mobil för app-känsla
