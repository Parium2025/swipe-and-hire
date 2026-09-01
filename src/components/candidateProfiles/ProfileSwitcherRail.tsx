import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Star, Video as VideoIcon, User, ChevronDown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCandidateProfiles,
  type CandidateProfile, type CandidateProfileInput,
} from '@/hooks/useCandidateProfiles';
import CandidateProfileEditor from './CandidateProfileEditor';

interface Props {
  userId?: string;
  /** Signerad URL till grundprofilens bild (om någon). */
  baseImageUrl?: string | null;
  /** Om grundprofilen har en video istället för bild. */
  baseHasVideo?: boolean;
  /** Anropas när valet ändras – null betyder att grundprofilen ("Min profil") är vald. */
  onActiveProfileChange?: (profile: CandidateProfile | null) => void;
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
export function ProfileSwitcherRail({ userId, baseImageUrl, baseHasVideo, onActiveProfileChange }: Props) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    profiles, canCreateMore,
    createProfile, updateProfile, setDefaultProfile, clearDefaultProfile,
  } = useCandidateProfiles(userId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string>('base');

  const baseIsDefault = useMemo(() => !profiles.some((p) => p.is_default), [profiles]);
  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  const chips: ChipData[] = useMemo(() => [
    {
      id: 'base', label: 'Min profil', signedImageUrl: baseImageUrl ?? null,
      imagePath: null, hasVideo: !!baseHasVideo, isDefault: baseIsDefault,
    },
    ...profiles.map((p) => ({
      id: p.id, label: p.label, signedImageUrl: null,
      imagePath: p.profile_image_url, hasVideo: !!p.video_url, isDefault: p.is_default,
    })),
  ], [profiles, baseImageUrl, baseHasVideo, baseIsDefault]);

  // Standardprofilen ligger alltid först; övriga följer i sin ordning.
  const orderedChips = useMemo(() => {
    const def = chips.filter((c) => c.isDefault);
    const rest = chips.filter((c) => !c.isDefault);
    return [...def, ...rest];
  }, [chips]);

  // När standardprofilen ändras (t.ex. via stjärnan) ska den också bli aktiv
  // och därmed glida in i mitten av karusellen.
  const defaultChipId = baseIsDefault ? 'base' : profiles.find((p) => p.is_default)?.id ?? 'base';
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

  const selectChip = (id: string) => setActiveId(id);

  const makeDefault = async (id: string) => {
    if (id === 'base') {
      if (!baseIsDefault) await clearDefaultProfile();
    } else {
      const p = profiles.find((x) => x.id === id);
      if (p && !p.is_default) await setDefaultProfile(id);
    }
    // Den stjärnmarkerade ska också visas som vald (ligga i mitten).
    setActiveId(id);
  };

  const handleSave = async (input: CandidateProfileInput) => {
    setSaving(true);
    const res = editing
      ? await updateProfile(editing.id, input)
      : await createProfile(input);
    setSaving(false);

    if ('error' in res && res.error) {
      toast({ title: 'Kunde inte spara', description: res.error, variant: 'destructive' });
      return;
    }
    if (!editing && 'data' in res) {
      const created = (res as { data?: CandidateProfile }).data;
      if (created) setActiveId(created.id);
    }
    setEditorOpen(false);
    toast({ title: editing ? 'Profil uppdaterad' : 'Profil skapad', description: input.label });
  };

  const activeChip = chips.find((c) => c.id === activeId) ?? chips[0];

  const editor = (
    <CandidateProfileEditor
      open={editorOpen}
      onOpenChange={setEditorOpen}
      profile={editing}
      saving={saving}
      onSave={handleSave}
    />
  );

  // Mobil: rullgardinsmeny – aldrig avklippta kort i kanten.
  if (isMobile) {
    return (
      <div className="flex justify-center">
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
                      className="h-4 w-4"
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

  return (
    <div className="space-y-2">
      <div className="relative mx-auto h-[128px] w-full max-w-[460px]">
        {slots.map((slot, idx) => {
          const offset = idx - activeIndex;
          const isCenter = offset === 0;
          const isVisible = Math.abs(offset) <= 1;

          return (
            <div
              key={slot.key}
              className="absolute left-1/2 top-0 transition-all duration-300 ease-out"
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
                  onSelect={() => selectChip(slot.chip!.id)}
                  onToggleDefault={() => makeDefault(slot.chip!.id)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {editor}
    </div>
  );
}

export default ProfileSwitcherRail;
