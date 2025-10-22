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
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">

// 4 kolumner stats
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
```

### Padding/margin breakpoints
- Använd `md:` prefix för tablet/desktop
- Standard är mobile-first

## Viktiga principer

1. **Alltid `backdrop-blur-sm`** på kort för djup och konsistens
2. **Alltid `p-6 md:p-4`** på nya kort
3. **Använd semantiska tokens** - inga hårdkodade färger
4. **Konsekvent spacing** - följ space-y patterns
5. **Responsive design** - mobile-first approach
