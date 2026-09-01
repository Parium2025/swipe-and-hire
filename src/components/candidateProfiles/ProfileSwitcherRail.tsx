import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
  chipRef?: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onToggleDefault: () => void;
}

/** Ett profil-chip i raden. Miniatyr + namn + stjärna för standard. */
function ProfileChip({
  label, imagePath, hasVideo, active, isDefault, signedImageUrl, chipRef, onSelect, onToggleDefault,
}: ChipProps) {
  return (
    <div
      ref={chipRef}
      className={`relative shrink-0 snap-center w-[104px] rounded-2xl border p-2.5 text-center transition-colors touch-manipulation ${
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
          className="h-3.5 w-3.5"
          style={isDefault ? { color: '#FFC44D', fill: '#FFC44D' } : { color: '#FFFFFF' }}
        />
      </button>
    </div>
  );
}

/**
 * Profilväljare överst i "Profilbild/Profilvideo".
 * Mobil: kompakt rullgardinsmeny. Större skärmar: rad med chips.
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

  // Refs per chip + rail-container, så att vi kan centrera det valda/standard-chipet.
  const chipRefs = React.useRef(new Map<string, HTMLDivElement>());
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const setChipRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) chipRefs.current.set(id, el); else chipRefs.current.delete(id);
  }, []);
  // Manuell centrering av railens scrollposition (scrollIntoView kan störa sidans scroll).
  const centerChip = useCallback((id: string) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rail = railRef.current;
        const chip = chipRefs.current.get(id);
        if (!rail || !chip) return;
        const target = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
        rail.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      }, 60);
    });
  }, []);

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

  // Standardprofilen (stjärnan) ska alltid ligga först i raden – ingen profil
  // får aldrig hamna framför standarden. "Ny profil"-rutan ligger alltid sist.
  const orderedChips = useMemo(() => {
    const def = chips.filter((c) => c.isDefault);
    const rest = chips.filter((c) => !c.isDefault);
    return [...def, ...rest];
  }, [chips]);

  // När standardprofilen ändras (t.ex. via stjärnan) ska standard-chipet alltid
  // glida in i mitten – även efter att listan renderats om.
  const defaultChipId = baseIsDefault ? 'base' : profiles.find((p) => p.is_default)?.id ?? 'base';
  const prevDefaultRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (prevDefaultRef.current === null) { prevDefaultRef.current = defaultChipId; return; }
    if (prevDefaultRef.current !== defaultChipId) {
      prevDefaultRef.current = defaultChipId;
      centerChip(defaultChipId);
    }
  }, [defaultChipId, centerChip]);

  // Meddela föräldern (Profile.tsx) vilken profil som är vald så att
  // huvudytan kan visa just den profilens bild/video.
  useEffect(() => {
    onActiveProfileChange?.(activeProfile);
  }, [activeProfile, onActiveProfileChange]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };

  const selectChip = (id: string) => { setActiveId(id); centerChip(id); };

  const makeDefault = async (id: string) => {
    if (id === 'base') {
      if (!baseIsDefault) await clearDefaultProfile();
    } else {
      const p = profiles.find((x) => x.id === id);
      if (p && !p.is_default) await setDefaultProfile(id);
    }
    // Den stjärnmarkerade ska också visas som vald (komma upp i knappen).
    setActiveId(id);
    centerChip(id);
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
      if (created) { setActiveId(created.id); centerChip(created.id); }
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

  return (
    <div className="space-y-2">
      {/* Yttre flex centrerar raden när den får plats; inre div scrollar när den inte gör det. */}
      <div className="flex justify-center">
        <div
          ref={railRef}
          className="flex max-w-full snap-x snap-proximity gap-2.5 overflow-x-auto px-2 pb-1 pt-2 scroll-px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {orderedChips.map((chip) => (
            <ProfileChip
              key={chip.id}
              {...chip}
              active={activeId === chip.id}
              chipRef={setChipRef(chip.id)}
              onSelect={() => selectChip(chip.id)}
              onToggleDefault={() => makeDefault(chip.id)}
            />
          ))}

          {canCreateMore && (
            <button
              type="button"
              onClick={openNew}
              aria-label="Lägg till profil"
              className="shrink-0 snap-center w-[104px] rounded-2xl border border-dashed border-white/20 bg-white/5 p-2.5 text-center text-white transition-colors md:hover:bg-white/10 touch-manipulation"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <Plus className="h-5 w-5" />
              </span>
              <span className="mt-2 block truncate text-[12px] font-medium leading-tight">Ny profil</span>
            </button>
          )}
        </div>
      </div>

      {editor}
    </div>
  );
}

export default ProfileSwitcherRail;
