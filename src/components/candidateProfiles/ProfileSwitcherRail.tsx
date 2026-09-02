import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Star, Video as VideoIcon, User, ChevronDown, Check, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import {
  useCandidateProfiles,
  type CandidateProfile, type CandidateProfileInput,
} from '@/hooks/useCandidateProfiles';
import CandidateProfileEditor from './CandidateProfileEditor';


interface Props {
  userId?: string;
  /** Signerad URL till grundprofilens bild (om någon). */
  baseImageUrl?: string | null;
  /** Signerad URL till grundprofilens cover-bild (används om profilen är en video). */
  baseCoverUrl?: string | null;
  /** Om grundprofilen har en video istället för bild. */
  baseHasVideo?: boolean;
  /** Anropas när valet ändras – null betyder att grundprofilen ("Min profil") är vald. */
  onActiveProfileChange?: (profile: CandidateProfile | null) => void;
}

/** Utåtriktade kommandon så att profilsidan kan öppna redigeraren för vald profil. */
export interface ProfileSwitcherRailHandle {
  editActiveProfile: () => void;
  /** Sparar media direkt på den valda extraprofilen (egen tunnel). */
  updateActiveProfile: (patch: Partial<CandidateProfileInput>) => Promise<void>;
  /**
   * Sparar media på en specifik profil. Används av långa uppladdningar så att
   * mediat alltid hamnar på den profil som var vald när uppladdningen startade
   * — även om användaren hinner byta profil under tiden.
   */
  updateProfileById: (profileId: string, patch: Partial<CandidateProfileInput>) => Promise<void>;
}


interface ChipData {
  id: string;
  label: string;
  imagePath: string | null;
  signedImageUrl: string | null;
  hasVideo: boolean;
  isDefault: boolean;
}

/** Rund miniatyr för en profil – bild, videoikon eller personikon. */
function ProfileAvatar({
  imagePath, signedImageUrl, hasVideo, size = 56,
}: { imagePath?: string | null; signedImageUrl?: string | null; hasVideo?: boolean; size?: number }) {
  const resolved = useMediaUrl(imagePath || undefined, 'profile-image');
  const src = signedImageUrl ?? resolved;

  return (
    <span
      className="flex items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10"
      style={{ height: size, width: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : hasVideo ? (
        <VideoIcon className="h-5 w-5 text-white" />
      ) : (
        <User className="h-5 w-5 text-white" />
      )}
    </span>
  );
}

interface ChipProps extends ChipData {
  active: boolean;
  /** Sant precis när stjärnan slagits på – ger en kort pop-animation. */
  starBurst?: boolean;
  onSelect: () => void;
  onToggleDefault: () => void;
}

/** Ett profilkort i karusellen. Miniatyr + namn + stjärna för standard. */
function ProfileChip({
  label, imagePath, hasVideo, active, isDefault, signedImageUrl, starBurst, onSelect, onToggleDefault,
}: ChipProps) {
  return (
    <div
      className={`relative w-[104px] rounded-2xl border p-2.5 text-center transition-colors touch-manipulation ${
        active ? 'border-white/60 bg-white/10' : 'border-white/10 bg-white/5 md:hover:bg-white/10'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full outline-none focus:outline-none focus-visible:outline-none"
        aria-pressed={active}
      >
        <span className="mx-auto block w-14">
          <ProfileAvatar imagePath={imagePath} signedImageUrl={signedImageUrl} hasVideo={hasVideo} />
        </span>
        <span className="mt-2 block truncate text-[12px] font-medium leading-tight text-white">
          {label}
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleDefault}
        title={isDefault ? 'Standardprofil' : 'Gör till standard'}
        aria-label={isDefault ? 'Standardprofil' : 'Gör till standard'}
        className="absolute -top-1.5 -right-1.5 rounded-full border border-white/20 bg-[#0b2a55] p-1.5 transition-colors md:hover:bg-white/15"
      >
        <Star
          className={`h-3.5 w-3.5 transition-colors duration-200 ${starBurst ? 'animate-star-pop' : ''}`}
          style={isDefault ? { color: '#FFC44D', fill: '#FFC44D' } : { color: '#FFFFFF' }}
        />
      </button>
    </div>
  );
}

/** Avstånd mellan kortpositionerna i karusellen (kortbredd 104px + mellanrum). */
const SLOT_SPACING = 116;

/**
 * Profilväljare överst i "Profilbild/Profilvideo".
 * Mobil: kompakt rullgardinsmeny. Större skärmar: karusell som jobbkorten –
 * aktivt kort i mitten, grannar tittar fram till vänster/höger, och ett tryck
 * på ett sidokort glidande flyttar det till mitten.
 */
export const ProfileSwitcherRail = React.forwardRef<ProfileSwitcherRailHandle, Props>(function ProfileSwitcherRail(
  { userId, baseImageUrl, baseCoverUrl, baseHasVideo, onActiveProfileChange }: Props,
  ref,
) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    profiles, canCreateMore,
    createProfile, updateProfile, deleteProfile, setDefaultProfile, clearDefaultProfile,
  } = useCandidateProfiles(userId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string>('base');
  // Profil som väntar på bekräftad borttagning.
  const [deleteTarget, setDeleteTarget] = useState<CandidateProfile | null>(null);
  // Ångra-fönster: profilen döljs direkt men raderas i databasen först efter
  // några sekunder, så att "Ångra" kan avbryta utan att något gått förlorat.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteRef = React.useRef<{ id: string; timer: number } | null>(null);
  // Optimistisk stjärna: kortet flyttar sig direkt, innan databasen svarat.
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);
  const [starBurstId, setStarBurstId] = useState<string | null>(null);

  // Tangentbord: karusellen ska svara på piltangenter även när fokus ligger på
  // ett kort inuti raden eller när musen bara hovrar över den.
  const railRef = React.useRef<HTMLDivElement>(null);
  const railHoverRef = React.useRef(false);
  const railKeyHandlerRef = React.useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => railKeyHandlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);




  const dbDefaultId = useMemo(
    () => profiles.find((p) => p.is_default)?.id ?? 'base',
    [profiles],
  );
  const effectiveDefaultId = pendingDefaultId ?? dbDefaultId;
  const baseIsDefault = effectiveDefaultId === 'base';
  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  // Släpp den optimistiska markeringen när databasen hunnit ikapp.
  useEffect(() => {
    if (pendingDefaultId && dbDefaultId === pendingDefaultId) setPendingDefaultId(null);
  }, [pendingDefaultId, dbDefaultId]);

  const chips: ChipData[] = useMemo(() => [
    {
      id: 'base', label: 'Min profil', signedImageUrl: baseImageUrl ?? baseCoverUrl ?? null,
      imagePath: null, hasVideo: !!baseHasVideo, isDefault: baseIsDefault,
    },
    ...profiles.filter((p) => p.id !== pendingDeleteId).map((p) => ({
      id: p.id, label: p.label, signedImageUrl: null,
      // Miniatyr: profilbilden i första hand, annars cover-bilden. Aldrig videon.
      imagePath: p.profile_image_url || p.cover_image_url,
      hasVideo: !!p.video_url,
      isDefault: p.id === effectiveDefaultId,
    })),
  ], [profiles, pendingDeleteId, baseImageUrl, baseCoverUrl, baseHasVideo, baseIsDefault, effectiveDefaultId]);

  // Ordningen ligger fast (grundprofilen först, sedan skapandeordning) så att
  // stjärnan bara glider in kortet i mitten – inga kort byter plats med varandra.
  const orderedChips = chips;

  // När standardprofilen ändras (t.ex. via stjärnan) ska den också bli aktiv
  // och därmed glida in i mitten av karusellen.
  const defaultChipId = effectiveDefaultId;
  const prevDefaultRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (prevDefaultRef.current === null) { prevDefaultRef.current = defaultChipId; return; }
    if (prevDefaultRef.current !== defaultChipId) {
      prevDefaultRef.current = defaultChipId;
      setActiveId(defaultChipId);
    }
  }, [defaultChipId]);

  // Meddela föräldern (Profile.tsx) vilken profil som är vald så att
  // huvudytan kan visa just den profilens bild/video.
  useEffect(() => {
    onActiveProfileChange?.(activeProfile);
  }, [activeProfile, onActiveProfileChange]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };

  React.useImperativeHandle(ref, () => ({
    editActiveProfile: () => {
      if (!activeProfile) return;
      setEditing(activeProfile);
      setEditorOpen(true);
    },
    updateActiveProfile: async (patch: Partial<CandidateProfileInput>) => {
      if (!activeProfile) throw new Error('Ingen profil är vald.');
      const res = await updateProfile(activeProfile.id, patch);
      if ('error' in res && res.error) {
        toast({ title: 'Kunde inte spara', description: res.error, variant: 'destructive' });
        throw new Error(res.error);
      }
    },
    updateProfileById: async (profileId: string, patch: Partial<CandidateProfileInput>) => {
      const res = await updateProfile(profileId, patch);
      if ('error' in res && res.error) {
        toast({ title: 'Kunde inte spara', description: res.error, variant: 'destructive' });
        throw new Error(res.error);
      }
    },
  }), [activeProfile, updateProfile, toast]);

  const selectChip = (id: string) => setActiveId(id);

  const makeDefault = async (id: string) => {
    if (id === effectiveDefaultId) return;
    // Direkt visuell respons: stjärnan poppar och kortet glider till mitten.
    setPendingDefaultId(id);
    setActiveId(id);
    setStarBurstId(id);
    window.setTimeout(() => setStarBurstId((cur) => (cur === id ? null : cur)), 600);

    if (id === 'base') {
      await clearDefaultProfile();
    } else {
      await setDefaultProfile(id);
    }
  };


  const handleSave = async (input: CandidateProfileInput) => {
    setSaving(true);
    const res = editing
      ? await updateProfile(editing.id, input)
      : await createProfile(input);
    setSaving(false);

    if ('error' in res && res.error) {
      toast({ title: 'Kunde inte spara', description: res.error, variant: 'destructive' });
      return false;
    }
    if (!editing && 'data' in res) {
      const created = (res as { data?: CandidateProfile }).data;
      if (created) setActiveId(created.id);
    }
    setEditorOpen(false);
    toast({ title: editing ? 'Profil uppdaterad' : 'Profil skapad', description: input.label });
    return true;
  };

  const activeChip = chips.find((c) => c.id === activeId) ?? chips[0];

  const requestDelete = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (profile) setDeleteTarget(profile);
  };

  /** Kör den uppskjutna raderingen på riktigt (efter ångra-fönstret). */
  const commitDelete = React.useCallback(async (id: string, label: string) => {
    pendingDeleteRef.current = null;
    const res = await deleteProfile(id);
    setPendingDeleteId((cur) => (cur === id ? null : cur));
    if ('error' in res && res.error) {
      toast({ title: 'Kunde inte ta bort', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ id: 'profile-delete', title: 'Profil borttagen', description: `${label} är borttagen.` });
  }, [deleteProfile, toast]);

  // Lämnar användaren sidan innan ångra-fönstret löpt ut ska raderingen ändå
  // gå igenom – annars skulle profilen "återuppstå" vid nästa besök.
  useEffect(() => () => {
    const pending = pendingDeleteRef.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      void deleteProfile(pending.id);
    }
  }, [deleteProfile]);

  const confirmDelete = () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    if (activeId === target.id) setActiveId('base');
    setPendingDeleteId(target.id);

    const timer = window.setTimeout(() => { void commitDelete(target.id, target.label); }, 6000);
    pendingDeleteRef.current = { id: target.id, timer };

    toast({
      id: 'profile-delete',
      title: 'Profil borttagen',
      description: `${target.label} är borttagen.`,
      duration: 6000,
      action: {
        label: 'Ångra',
        onClick: () => {
          const pending = pendingDeleteRef.current;
          if (!pending || pending.id !== target.id) return;
          window.clearTimeout(pending.timer);
          pendingDeleteRef.current = null;
          setPendingDeleteId(null);
          setActiveId(target.id);
        },
      } as unknown as React.ReactNode,
    });
  };

  const editor = (
    <>
      <CandidateProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editing}
        saving={saving}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort profil
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {deleteTarget ? `Vill du ta bort "${deleteTarget.label}"? Profilen och dess val av bild, video och CV tas bort.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel
              onClick={() => setDeleteTarget(null)}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );


  // Mobil: rullgardinsmeny – aldrig avklippta kort i kanten.
  if (isMobile) {
    return (
      <div className="flex flex-col items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex min-h-[56px] w-full max-w-[320px] items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-left text-white touch-manipulation active:bg-white/10"
              aria-label="Byt profil"
            >
              <ProfileAvatar
                imagePath={activeChip?.imagePath}
                signedImageUrl={activeChip?.signedImageUrl}
                hasVideo={activeChip?.hasVideo}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium leading-tight text-white">
                  {activeChip?.label}
                </span>
                <span className="block text-[12px] leading-tight text-white">
                  {activeChip?.isDefault ? 'Standardprofil' : 'Tryck för att byta profil'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-white transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="center" className="w-[288px] p-1">
            {orderedChips.map((chip, idx) => (
              <Fragment key={chip.id}>
                {idx > 0 && <div className="mx-2 h-px bg-white/10" />}
                <DropdownMenuItem
                  onSelect={() => selectChip(chip.id)}
                  className="flex items-center gap-3 py-2"
                >
                  <ProfileAvatar
                    imagePath={chip.imagePath}
                    signedImageUrl={chip.signedImageUrl}
                    hasVideo={chip.hasVideo}
                    size={32}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{chip.label}</span>
                  {activeId === chip.id && <Check className="h-4 w-4 shrink-0" />}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); void makeDefault(chip.id); }}
                    aria-label={chip.isDefault ? 'Standardprofil' : 'Gör till standard'}
                    className="-my-1 shrink-0 rounded-full p-2 touch-manipulation"
                  >
                    <Star
                      className={`h-4 w-4 ${starBurstId === chip.id ? 'animate-star-pop' : ''}`}
                      style={chip.isDefault ? { color: '#FFC44D', fill: '#FFC44D' } : { color: 'currentColor' }}
                    />
                  </button>
                </DropdownMenuItem>
              </Fragment>
            ))}

            {canCreateMore && (
              <>
                <div className="mx-2 h-px bg-white/10" />
                <DropdownMenuItem onSelect={openNew} className="flex items-center gap-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current/20">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="text-[14px]">Lägg till profil</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {activeId !== 'base' && (
          <button
            type="button"
            onClick={() => requestDelete(activeId)}
            title="Ta bort profil"
            aria-label="Ta bort profil"
            className="flex items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg transition-colors touch-manipulation active:bg-destructive/30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        {editor}
      </div>
    );
  }

  // Desktop: karusell. "Ny profil" är sista platsen i karusellen.
  type Slot = { key: string; chip?: ChipData; isAdd?: boolean };
  const slots: Slot[] = [
    ...orderedChips.map((chip) => ({ key: chip.id, chip })),
    ...(canCreateMore ? [{ key: 'add', isAdd: true } as Slot] : []),
  ];
  const activeIndex = Math.max(0, slots.findIndex((s) => s.key === activeId));

  // Tangentbord: piltangenter flyttar mellan korten, Home/End hoppar längst ut,
  // Enter/Blanksteg öppnar "Ny profil" och Delete tar bort vald extraprofil.
  const runRailKey = (e: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>, focusInside = true) => {
    const move = (next: number) => {
      e.preventDefault();
      const clamped = Math.min(slots.length - 1, Math.max(0, next));
      const slot = slots[clamped];
      if (slot) setActiveId(slot.key);
    };
    switch (e.key) {
      case 'ArrowLeft': move(activeIndex - 1); break;
      case 'ArrowRight': move(activeIndex + 1); break;
      case 'Home': move(0); break;
      case 'End': move(slots.length - 1); break;
      case 'Enter':
      case ' ':
        if (slots[activeIndex]?.isAdd) { e.preventDefault(); openNew(); }
        break;
      // Radering kräver att fokus faktiskt ligger i karusellen — Backspace är
      // en webbläsargenväg och får aldrig öppna en raderingsdialog av misstag.
      case 'Delete':
        if (focusInside && activeId !== 'base' && !slots[activeIndex]?.isAdd) {
          e.preventDefault();
          requestDelete(activeId);
        }
        break;
      default: break;
    }
  };

  // Global lyssnare: fungerar när fokus ligger på ett kort i raden eller när
  // musen hovrar över karusellen — men aldrig när man skriver i ett fält
  // eller har en dialog öppen.
  railKeyHandlerRef.current = (e: KeyboardEvent) => {
    if (editorOpen || deleteTarget) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const focusInside = !!railRef.current && railRef.current.contains(document.activeElement);
    if (!focusInside && !railHoverRef.current) return;
    runRailKey(e, focusInside);
  };

  return (
    <div className="space-y-2">
      <div
        ref={railRef}
        className="relative mx-auto h-[128px] w-full max-w-[460px] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        role="listbox"
        aria-label="Välj profil"
        aria-activedescendant={`profile-slot-${slots[activeIndex]?.key ?? 'base'}`}
        tabIndex={0}
        onMouseEnter={() => { railHoverRef.current = true; }}
        onMouseLeave={() => { railHoverRef.current = false; }}
        onKeyDown={(e) => { if (e.target === e.currentTarget) runRailKey(e, true); }}
      >

        {slots.map((slot, idx) => {
          const offset = idx - activeIndex;
          const isCenter = offset === 0;
          const isVisible = Math.abs(offset) <= 1;

          return (
            <div
              key={slot.key}
              id={`profile-slot-${slot.key}`}
              role={slot.isAdd ? undefined : 'option'}
              aria-selected={slot.isAdd ? undefined : isCenter}
              className="absolute left-1/2 top-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
              style={{
                transform: `translateX(calc(-50% + ${offset * SLOT_SPACING}px)) scale(${isCenter ? 1 : 0.85})`,
                opacity: isCenter ? 1 : isVisible ? 0.7 : 0,
                zIndex: isCenter ? 20 : isVisible ? 10 : 0,
                pointerEvents: isVisible ? 'auto' : 'none',
              }}
            >
              {slot.isAdd ? (
                <button
                  type="button"
                  onClick={openNew}
                  aria-label="Lägg till profil"
                  className="w-[104px] rounded-2xl border border-dashed border-white/20 bg-white/5 p-2.5 text-center text-white transition-colors md:hover:bg-white/10 touch-manipulation"
                >
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="mt-2 block truncate text-[12px] font-medium leading-tight">Ny profil</span>
                </button>
              ) : slot.chip ? (
                <ProfileChip
                  {...slot.chip}
                  active={activeId === slot.chip.id}
                  starBurst={starBurstId === slot.chip.id}
                  onSelect={() => selectChip(slot.chip!.id)}
                  onToggleDefault={() => makeDefault(slot.chip!.id)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {activeId !== 'base' && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => requestDelete(activeId)}
            title="Ta bort profil"
            aria-label="Ta bort profil"
            className="flex items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg transition-colors touch-manipulation md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {editor}
    </div>
  );
});


export default ProfileSwitcherRail;
