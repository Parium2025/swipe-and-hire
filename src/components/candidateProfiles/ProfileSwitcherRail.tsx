import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Plus, Star, Pencil, Trash2, Video as VideoIcon, User, AlertTriangle } from 'lucide-react';
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
  onSelect: () => void;
  onToggleDefault: () => void;
}

/** Ett profil-chip i raden. Miniatyr + namn + stjärna för standard. */
function ProfileChip({
  label, imagePath, hasVideo, active, isDefault, signedImageUrl, onSelect, onToggleDefault,
}: ChipProps) {
  const resolved = useMediaUrl(imagePath || undefined, 'profile-image');
  const src = signedImageUrl ?? resolved;

  return (
    <div
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
    createProfile, updateProfile, deleteProfile, setDefaultProfile, clearDefaultProfile,
  } = useCandidateProfiles(userId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CandidateProfile | null>(null);
  const [activeId, setActiveId] = useState<string>('base');

  const baseIsDefault = useMemo(() => !profiles.some((p) => p.is_default), [profiles]);
  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  // Meddela föräldern (Profile.tsx) vilken profil som är vald så att
  // huvudytan kan visa just den profilens bild/video.
  useEffect(() => {
    onActiveProfileChange?.(activeProfile);
  }, [activeProfile, onActiveProfileChange]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (p: CandidateProfile) => { setEditing(p); setEditorOpen(true); };

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

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const removedId = pendingDelete.id;
    const res = await deleteProfile(removedId);
    setPendingDelete(null);
    if ('error' in res && res.error) {
      toast({ title: 'Kunde inte ta bort', description: res.error, variant: 'destructive' });
      return;
    }
    if (activeId === removedId) setActiveId('base');
    toast({ title: 'Profil borttagen' });
  };

  return (
    <div className="space-y-2">
      <div
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 pt-2 px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <ProfileChip
          label="Min profil"
          signedImageUrl={baseImageUrl ?? null}
          hasVideo={baseHasVideo}
          active={activeId === 'base'}
          isDefault={baseIsDefault}
          onSelect={() => setActiveId('base')}
          onToggleDefault={() => { if (!baseIsDefault) clearDefaultProfile(); }}
        />

        {profiles.map((p) => (
          <ProfileChip
            key={p.id}
            label={p.label}
            imagePath={p.profile_image_url}
            hasVideo={!!p.video_url}
            active={activeId === p.id}
            isDefault={p.is_default}
            onSelect={() => setActiveId(p.id)}
            onToggleDefault={() => { if (!p.is_default) setDefaultProfile(p.id); }}
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

      <div className="flex items-center justify-center gap-2">
        {activeProfile ? (
          <>
            <button
              type="button"
              onClick={() => openEdit(activeProfile)}
              className="bg-white/5 backdrop-blur-sm border border-white/10 text-white md:hover:bg-white/10 md:hover:border-white/50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors touch-manipulation inline-flex items-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Redigera profil
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(activeProfile)}
              aria-label="Ta bort profil"
              className="rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white transition-colors md:hover:!bg-destructive/30 touch-manipulation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <p className="text-center text-xs text-white">
            Svep för att byta profil. Stjärnan visar vilken som används som standard vid ansökan
            (max {MAX_CANDIDATE_PROFILES} profiler).
          </p>
        )}
      </div>

      <CandidateProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editing}
        saving={saving}
        onSave={handleSave}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort profilen
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {pendingDelete?.label} tas bort permanent. Ansökningar du redan skickat påverkas inte – de behåller sin
              egen kopia av CV, video och bild.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </div>
  );
}

export default ProfileSwitcherRail;
