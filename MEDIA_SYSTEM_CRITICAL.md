# 🔒 KRITISKT: MEDIA-SYSTEM ARKITEKTUR
## ⚠️ DENNA FIL FÅR ALDRIG ÄNDRAS UTAN EXPLICIT GODKÄNNANDE

**Status:** LÅST OCH PERMANENT
**Senast verifierad:** 2025-11-12
**Ansvarig:** Fredrik

---

## 🚨 ABSOLUTA REGLER - FÅR ALDRIG BRYTAS

### 1️⃣ BUCKET-STRATEGI (ALDRIG ÄNDRA)

```typescript
// ✅ KORREKT - ANVÄND ALLTID DESSA BUCKETS:
const MEDIA_CONFIG = {
  'profile-image': { bucket: 'job-applications', isPublic: false },
  'profile-video': { bucket: 'job-applications', isPublic: false },
  'cover-image': { bucket: 'job-applications', isPublic: false },
  'cv': { bucket: 'job-applications', isPublic: false },
  'company-logo': { bucket: 'company-logos', isPublic: true },
  'job-image': { bucket: 'job-images', isPublic: true }
}

// ❌ FEL - FLYTTA ALDRIG KANDIDATMEDIA TILL PUBLIC BUCKETS:
// 'profile-image': { bucket: 'profile-media', isPublic: true } // FÖRBJUDET!
```

**Varför?**
- Kandidatmedia MÅSTE vara privat för säkerhet
- Arbetsgivare får åtkomst via RLS-policies och signed URLs
- Public buckets = vem som helst kan se media = SÄKERHETSRISK

---

### 2️⃣ DATABAS-LAGRING (ALDRIG ÄNDRA)

```typescript
// ✅ KORREKT - SPARA ENDAST STORAGE PATH:
updates.profile_image_url = "user-id/1234567890-abc123.jpg"
updates.video_url = "user-id/1234567890-xyz789.mp4"
updates.cv_url = "user-id/1234567890-doc456.pdf"

// ❌ FEL - SPARA ALDRIG FULL URL:
updates.profile_image_url = "https://...signed-url..." // FÖRBJUDET!
```

**Varför?**
- Signed URLs går ut efter 24 timmar
- Storage paths är permanenta
- System genererar nya signed URLs on-demand automatiskt

---

### 3️⃣ UPLOAD-FLÖDE (ALDRIG ÄNDRA)

```typescript
// ✅ KORREKT - ANVÄND ALLTID mediaManager:
import { uploadMedia } from '@/lib/mediaManager';

const { storagePath, error } = await uploadMedia(
  file,
  'profile-image', // eller 'profile-video', 'cv', etc.
  userId
);

// Spara ENDAST storagePath i databasen
updates.profile_image_url = storagePath;

// ❌ FEL - ANVÄND ALDRIG DIREKT SUPABASE STORAGE:
// const { data } = await supabase.storage.from('profile-media').upload(...) // FÖRBJUDET!
```

**Varför?**
- mediaManager validerar filstorlek och filtyper
- mediaManager väljer rätt bucket automatiskt
- mediaManager skapar säkra filnamn
- Direkt Supabase-anrop kan välja fel bucket

---

### 4️⃣ VISNINGS-FLÖDE (ALDRIG ÄNDRA)

```typescript
// ✅ KORREKT - ANVÄND useMediaUrl hook:
import { useMediaUrl } from '@/hooks/useMediaUrl';

const signedProfileUrl = useMediaUrl(profile?.profile_image_url, 'profile-image');

<img src={signedProfileUrl} alt="Profilbild" />

// ❌ FEL - ANVÄND ALDRIG STORAGE PATH DIREKT:
// <img src={profile?.profile_image_url} alt="Profilbild" /> // FÖRBJUDET!
```

**Varför?**
- useMediaUrl genererar signed URLs automatiskt
- Private media kräver signering för åtkomst
- Hook hanterar backward compatibility (gamla public URLs)

---

## 📁 KRITISKA FILER - FÅR EJ ÄNDRAS UTAN GRANSKNING

### 1. `src/lib/mediaManager.ts`
**Status:** 🔒 KÄRNFIL - HÖGSTA SKYDDSNIVÅ

**Tillåtna ändringar:**
- ✅ Lägga till NYA mediatyper (t.ex. 'portfolio-image')
- ✅ Justera maxSizeMB för befintliga typer
- ✅ Lägga till nya allowedTypes

**FÖRBJUDNA ändringar:**
- ❌ Ändra bucket för befintliga mediatyper
- ❌ Ändra isPublic för kandidatmedia
- ❌ Ta bort filvalidering
- ❌ Ändra returvärde från uploadMedia (måste returnera storagePath)

### 2. `src/hooks/useMediaUrl.ts`
**Status:** 🔒 KRITISK

**FÖRBJUDNA ändringar:**
- ❌ Ta bort getMediaUrl-anrop
- ❌ Returnera storage path direkt utan signering

### 3. Storage RLS Policies
**Status:** 🔒 SÄKERHETSKRITISK

**Senaste migration:** `[timestamp]_job_applications_select_secure.sql`

**FÖRBJUDNA ändringar:**
- ❌ Ta bort permission-kontroll i SELECT-policy
- ❌ Tillåta public åtkomst till job-applications bucket
- ❌ Ta bort user-id-kontroll i INSERT-policy

---

## ✅ SÅ HÄR ARBETAR VI MED SYSTEMET FRAMÅT

### När du skapar nya upload-funktioner:

```typescript
// ✅ KORREKT:
import { uploadMedia } from '@/lib/mediaManager';

const handleUpload = async (file: File) => {
  const { storagePath, error } = await uploadMedia(
    file,
    'profile-image', // Använd rätt mediatyp
    userId
  );
  
  if (error) {
    // Hantera fel
    return;
  }
  
  // Spara storagePath i databasen
  await supabase
    .from('profiles')
    .update({ profile_image_url: storagePath })
    .eq('user_id', userId);
};
```

### När du visar uppladdad media:

```typescript
// ✅ KORREKT:
import { useMediaUrl } from '@/hooks/useMediaUrl';

const MyComponent = ({ profile }) => {
  const imageUrl = useMediaUrl(profile?.profile_image_url, 'profile-image');
  
  return <img src={imageUrl} alt="Profile" />;
};
```

---

## 🚫 VANLIGA MISSTAG - UNDVIK DESSA

### ❌ MISSTAG 1: Byta till public bucket
```typescript
// FEL - GÖR ALDRIG DETTA:
const config = {
  'profile-image': { 
    bucket: 'profile-media', // ❌ FÖRBJUDET
    isPublic: true // ❌ FÖRBJUDET
  }
}
```

### ❌ MISSTAG 2: Spara URL istället för path
```typescript
// FEL - GÖR ALDRIG DETTA:
const { data } = await supabase.storage.from('job-applications').upload(...);
const url = supabase.storage.from('job-applications').getPublicUrl(data.path);
updates.profile_image_url = url.publicUrl; // ❌ FÖRBJUDET
```

### ❌ MISSTAG 3: Använda storage path direkt i UI
```typescript
// FEL - GÖR ALDRIG DETTA:
<img src={profile.profile_image_url} /> // ❌ FÖRBJUDET (fungerar inte för private media)
```

### ❌ MISSTAG 4: Direkt Supabase-anrop
```typescript
// FEL - GÖR ALDRIG DETTA:
await supabase.storage.from('profile-media').upload(...) // ❌ FÖRBJUDET
// Använd ALLTID mediaManager.uploadMedia()
```

---

## 📋 CHECKLISTA VID ÄNDRINGAR

Innan du gör NÅGON ändring som rör media, kontrollera:

- [ ] Använder jag `uploadMedia` från mediaManager?
- [ ] Sparar jag endast storage path (inte URL) i databasen?
- [ ] Använder jag `useMediaUrl` för att visa media?
- [ ] Har jag INTE ändrat bucket-konfigurationen?
- [ ] Har jag INTE ändrat isPublic för kandidatmedia?
- [ ] Har jag INTE bypassed RLS-policies?

**Om du svarar NEJ på någon punkt → STOPP! Gör om det korrekt.**

---

## 🔧 TEKNISK ARKITEKTUR

### Dataflöde - Upload:
```
1. Användare väljer fil
   ↓
2. uploadMedia(file, mediaType, userId)
   ↓
3. Validering (storlek, typ)
   ↓
4. Upload till job-applications/{userId}/{timestamp}-{random}.ext
   ↓
5. Returnera storagePath
   ↓
6. Spara storagePath i databas (profiles.profile_image_url)
```

### Dataflöde - Visning:
```
1. Hämta profile från databas
   ↓
2. useMediaUrl(profile.profile_image_url, 'profile-image')
   ↓
3. getMediaUrl() genererar signed URL
   ↓
4. RLS-policy verifierar åtkomst
   ↓
5. Returnera signed URL till UI
   ↓
6. <img src={signedUrl} />
```

### Security Model:
```
Storage Bucket (job-applications)
├─ Private bucket (isPublic: false)
├─ RLS Policies:
│  ├─ SELECT: User sees own files + Employers with permission
│  ├─ INSERT: User can only upload to own folder
│  ├─ UPDATE: User can only update own files
│  └─ DELETE: User can only delete own files
└─ Signed URLs (24h expiration, regenerated on-demand)
```

---

## 📞 VID PROBLEM

Om något slutar fungera med media-systemet:

1. **Kontrollera inte bucket-config ändrats** i `mediaManager.ts`
2. **Verifiera att storagePath sparas** (inte URL) i databasen
3. **Kör Supabase linter** för att hitta RLS-problem
4. **Granska senaste migration** som rörde storage.objects

**Återställ till denna dokumenterade arkitektur om något är trasigt.**

---

## 🎯 SAMMANFATTNING

**DET HÄR SYSTEMET ÄR LÅST OCH PERMANENT:**

✅ Kandidatmedia → Private bucket (job-applications)  
✅ Storage paths → Databas  
✅ Signed URLs → Genereras on-demand  
✅ RLS-policies → Permission-baserad åtkomst  
✅ mediaManager → Enda källan till sanning  

**ÄNDRA ALDRIG DENNA GRUNDLÄGGANDE ARKITEKTUR.**

**Vid tvivel: Följ denna dokumentation exakt.**

---

**Dokumentation skapad:** 2025-11-12  
**Senast verifierad:** 2025-11-12  
**Version:** 1.0 (LÅST)
