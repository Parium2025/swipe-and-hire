import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Star, Video as VideoIcon, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMediaUrl } from '@/hooks/useMediaUrl';
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

interface ChipProps {
  label: string;
  imagePath?: string | null;
  hasVideo?: boolean;
  active: boolean;
  isDefault: boolean;
  signedImageUrl?: string | null;
  chipRef?: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onToggleDefault: () => void;
}

/** Ett profil-chip i raden. Miniatyr + namn + stjärna för standard. */
function ProfileChip({
  label, imagePath, hasVideo, active, isDefault, signedImageUrl, chipRef, onSelect, onToggleDefault,
}: ChipProps) {
  const resolved = useMediaUrl(imagePath || undefined, 'profile-image');
  const src = signedImageUrl ?? resolved;

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
        <span className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : hasVideo ? (
            <VideoIcon className="h-5 w-5 text-white" />
          ) : (
            <User className="h-5 w-5 text-white" />
          )}
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
 * Svep mellan profiler på touch, sätt standard med stjärnan och skapa nya med plus-rutan.
 */
export function ProfileSwitcherRail({ userId, baseImageUrl, baseHasVideo, onActiveProfileChange }: Props) {
  const { toast } = useToast();
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
    // Dubbel rAF + kort timeout: vänta ut eventuell re-render efter data-mutation
    // så att chip-elementet som centreras är det som faktiskt är monterat.
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rail = railRef.current;
        const chip = chipRefs.current.get(id);
        if (!rail || !chip) return;
        const target = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
        rail.scrollTo({ left: target, behavior: 'smooth' });
      }, 50);
    });
  }, []);

  const baseIsDefault = useMemo(() => !profiles.some((p) => p.is_default), [profiles]);
  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

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
    // Standardprofilen centreras i raden så den alltid hamnar i mitten.
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


  return (
    <div className="space-y-2">
      {/* Yttre flex centrerar raden när den får plats; inre div scrollar när den inte gör det. */}
      <div className="flex justify-center">
      <div
        ref={railRef}
        className="flex max-w-full snap-x snap-proximity gap-2.5 overflow-x-auto pb-1 pt-2 px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <ProfileChip
          label="Min profil"
          signedImageUrl={baseImageUrl ?? null}
          hasVideo={baseHasVideo}
          active={activeId === 'base'}
          isDefault={baseIsDefault}
          chipRef={setChipRef('base')}
          onSelect={() => selectChip('base')}
          onToggleDefault={() => makeDefault('base')}
        />

        {profiles.map((p) => (
          <ProfileChip
            key={p.id}
            label={p.label}
            imagePath={p.profile_image_url}
            hasVideo={!!p.video_url}
            active={activeId === p.id}
            isDefault={p.is_default}
            chipRef={setChipRef(p.id)}
            onSelect={() => selectChip(p.id)}
            onToggleDefault={() => makeDefault(p.id)}
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

      <CandidateProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editing}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}

export default ProfileSwitcherRail;
