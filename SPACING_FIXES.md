# Spacing Fixes - Dokumentation

## Sammanfattning av ändringar

Alla spacing-problem i dialogrutorna har åtgärdats genom att:
1. Sätta `gap-0` på DialogContent (tar bort default mellanrum)
2. Sätta `p-0` på DialogContent (tar bort padding)
3. Minska `space-y` från `4` till `2` (mindre mellanrum mellan fält)
4. Minska `px` och `pb` från `4` till `3` (mindre padding)
5. Begränsa höjd med `max-h-[450px]` på scrollbart innehåll

---

## 1. MobileJobWizard.tsx

### DialogContent
```tsx
<DialogContent className="max-w-md max-h-[650px] bg-parium-gradient text-white [&>button]:hidden p-0 gap-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
```

**Nyckeländringar:**
- `gap-0` - Tar bort default gap
- `p-0` - Tar bort padding

### Wrapper Div
```tsx
<div className="bg-parium-gradient text-white flex flex-col overflow-hidden">
```

**Nyckeländringar:**
- Ingen `h-full` (låter höjden vara auto)
- `flex flex-col` för layout

### Header (Progressbar)
```tsx
<div className="px-3 pt-3 pb-2 border-b border-white/10">
  <div className="flex items-center justify-between mb-2">
    {/* Progress content */}
  </div>
  <Progress value={progressPercentage} className="h-1" />
</div>
```

**Nyckeländringar:**
- `px-3 pt-3 pb-2` - Mindre padding än tidigare `p-4`

### Scrollable Content
```tsx
<div 
  ref={scrollContainerRef} 
  className="overflow-y-auto px-3 pb-3 space-y-2 max-h-[450px]"
>
  {/* Form fields */}
</div>
```

**Nyckeländringar:**
- `space-y-2` istället för `space-y-4`
- `px-3 pb-3` istället för `p-4`
- `max-h-[450px]` begränsar höjd
- Ingen `flex-1` (viktigt!)

### Footer (Navigeringsknappar)
```tsx
<div className="px-3 pb-3 pt-2 border-t border-white/10 mt-auto">
  {/* Buttons */}
</div>
```

**Nyckeländringar:**
- `px-3 pb-3 pt-2` - Mindre padding

---

## 2. CreateTemplateWizard.tsx

### DialogContent
```tsx
<DialogContent className="max-w-md max-h-[650px] bg-parium-gradient text-white [&>button]:hidden p-0 gap-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
```

**Identiska ändringar som MobileJobWizard**

### Wrapper Div
```tsx
<div className="bg-parium-gradient text-white flex flex-col overflow-hidden">
```

### Header (Progressbar)
```tsx
<div className="px-3 pt-3 pb-2 border-b border-white/10">
  <div className="flex items-center justify-between mb-2">
    {/* Progress content */}
  </div>
  <Progress value={progressPercentage} className="h-1" />
</div>
```

### Scrollable Content
```tsx
<div 
  ref={scrollContainerRef} 
  className="overflow-y-auto px-3 pb-3 space-y-2 max-h-[450px]"
>
  {/* Form fields */}
</div>
```

### Footer (Navigeringsknappar)
```tsx
<div className="px-3 pb-3 pt-2 border-t border-white/10 mt-auto">
  {/* Buttons */}
</div>
```

---

## 3. EditJobDialog.tsx

### DialogContent
```tsx
<DialogContent className="max-w-md max-h-[650px] bg-parium-gradient text-white [&>button]:hidden p-0 gap-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
```

**Identiska ändringar som de andra två filerna**

### Wrapper Div
```tsx
<div className="bg-parium-gradient text-white flex flex-col overflow-hidden">
```

### Header (Progressbar)
```tsx
<div className="px-3 pt-3 pb-2 border-b border-white/10">
  <div className="flex items-center justify-between mb-2">
    {/* Progress content */}
  </div>
  <Progress value={progressPercentage} className="h-1" />
</div>
```

### Scrollable Content
```tsx
<div 
  ref={scrollContainerRef} 
  className="overflow-y-auto px-3 pb-3 space-y-2 max-h-[450px]"
>
  {/* Form fields */}
</div>
```

### Footer (Navigeringsknappar)
```tsx
<div className="px-3 pb-3 pt-2 border-t border-white/10 mt-auto">
  {/* Buttons */}
</div>
```

---

## Komplett Implementation Pattern

För alla tre filer följer samma struktur:

```tsx
<Dialog open={open} onOpenChange={handleDialogClose}>
  <DialogContent className="max-w-md max-h-[650px] bg-parium-gradient text-white [&>button]:hidden p-0 gap-0 flex flex-col border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden">
    
    {/* Wrapper - INGEN h-full! */}
    <div className="bg-parium-gradient text-white flex flex-col overflow-hidden">
      
      {/* Header med Progress */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <DialogTitle className="text-white text-sm font-medium">
            {steps[currentStep].title}
          </DialogTitle>
          <span className="text-white/60 text-xs">
            Steg {currentStep + 1} av {steps.length}
          </span>
        </div>
        <Progress value={progressPercentage} className="h-1" />
      </div>

      {/* Scrollable Content - max-h-[450px], INGEN flex-1! */}
      <div 
        ref={scrollContainerRef}
        className="overflow-y-auto px-3 pb-3 space-y-2 max-h-[450px]"
      >
        {/* Form fields här */}
      </div>

      {/* Footer med knappar */}
      <div className="px-3 pb-3 pt-2 border-t border-white/10 mt-auto">
        <div className="flex gap-2">
          {/* Navigation buttons */}
        </div>
      </div>

    </div>
  </DialogContent>
</Dialog>
```

---

## Viktiga CSS-klasser att komma ihåg

### DialogContent måste ha:
- `p-0` - Ingen padding
- `gap-0` - Inget gap mellan element
- `flex flex-col` - Flexbox layout
- `overflow-hidden` - Dölj overflow

### Scrollable content måste ha:
- `max-h-[450px]` - Maximal höjd
- `overflow-y-auto` - Scrollbar vid behov
- `space-y-2` - Mellanrum mellan fält (INTE 4)
- `px-3 pb-3` - Mindre padding (INTE p-4)
- **INGEN** `flex-1` - Detta skapar problemet!

### Wrapper div måste ha:
- **INGEN** `h-full` - Låt höjden vara auto
- `flex flex-col` - Flexbox layout
- `overflow-hidden` - Dölj overflow

---

## Felsökning

Om spacing fortfarande är fel, kolla:

1. **DialogContent har gap-0 och p-0**
   - Utan dessa kommer default spacing att synas

2. **Scrollable content har INGEN flex-1**
   - `flex-1` gör att elementet försöker ta upp allt utrymme

3. **Wrapper har INGEN h-full**
   - `h-full` tvingar full höjd och skapar onödigt utrymme

4. **space-y är 2 (inte 4)**
   - Större värden skapar för mycket mellanrum

5. **padding är 3 (inte 4)**
   - Mindre padding ger mer kompakt utseende

---

## Testning

För att verifiera att fixarna fungerar:

1. Öppna dialogen på mobil
2. Öppna dialogen på tablet
3. Öppna dialogen på desktop
4. Kontrollera att spacing ser identiskt ut på alla enheter
5. Kontrollera att det inte finns extra whitespace
6. Kontrollera att scrollning fungerar korrekt

---

## Datum: 2025-10-18

Dokumentationen skapad för Parium-projektet.
