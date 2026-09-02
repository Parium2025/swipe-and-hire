import React from 'react';
import { Check, ChevronDown, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProfileAvatar } from '@/components/candidateProfiles/ProfileAvatar';
import type { CandidateProfile } from '@/hooks/useCandidateProfiles';
import type { BaseApplicationProfile } from '@/hooks/useApplicationProfileSelection';

interface Props {
  profiles: CandidateProfile[];
  selectedId: string | null;
  onSelect: (profile: CandidateProfile | null) => void;
  baseProfile?: BaseApplicationProfile;
  dark?: boolean;
  selectionReset?: boolean;
}

interface PickerOption {
  id: string | null;
  label: string;
  cv_url: string | null;
  video_url: string | null;
  profile_image_url: string | null;
}

const toOption = (profile: CandidateProfile): PickerOption => ({
  id: profile.id,
  label: profile.label,
  cv_url: profile.cv_url,
  video_url: profile.video_url,
  profile_image_url: profile.profile_image_url,
});

/** Val av kandidatprofil i ansökningsformuläret – samma känsla som profilväxlaren i Min profil. */
export function CandidateProfilePicker({ profiles, selectedId, onSelect, baseProfile, dark = false, selectionReset = false }: Props) {
  const base: PickerOption = {
    id: null,
    label: 'Min profil',
    cv_url: baseProfile?.cv_url ?? null,
    video_url: baseProfile?.video_url ?? null,
    profile_image_url: baseProfile?.profile_image_url ?? null,
  };
  const options: PickerOption[] = [base, ...profiles.map(toOption)];
  const current = options.find((option) => option.id === selectedId) ?? base;

  const MediaStatus = ({ option }: { option: PickerOption }) => (
    <span className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] leading-tight ${dark ? 'text-white/90' : 'text-muted-foreground'}`}>
      <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{option.cv_url ? 'CV' : 'Inget CV'}</span>
      <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />{option.video_url ? 'Video' : 'Ingen video'}</span>
      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{option.profile_image_url ? 'Bild' : 'Ingen bild'}</span>
    </span>
  );

  const shell = dark
    ? 'border-white/15 bg-white/5 text-white active:bg-white/10 md:hover:bg-white/10'
    : 'border-border bg-muted/30 text-foreground active:bg-muted/50 md:hover:bg-muted/50';

  const summary = (option: PickerOption) => (
    <span className="min-w-0 flex-1 text-left">
      <span className={`block text-[11px] font-medium uppercase tracking-wide ${dark ? 'text-white/70' : 'text-muted-foreground'}`}>
        Du söker med
      </span>
      <span className="block truncate text-[15px] font-semibold leading-tight">{option.label}</span>
      <MediaStatus option={option} />
    </span>
  );

  return (
    <div className="w-full space-y-1.5">
      {selectionReset && (
        <p role="status" className={`text-xs ${dark ? 'text-white' : 'text-muted-foreground'}`}>
          Den valda profilen finns inte längre. Standardprofilen har valts.
        </p>
      )}

      {profiles.length === 0 ? (
        <div className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2 ${shell}`}>
          <ProfileAvatar imagePath={current.profile_image_url} hasVideo={!!current.video_url} size={44} />
          {summary(current)}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`group flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors touch-manipulation outline-none focus:outline-none focus-visible:outline-none ${shell}`}
              aria-label="Byt profil för ansökan"
            >
              <ProfileAvatar imagePath={current.profile_image_url} hasVideo={!!current.video_url} size={44} />
              {summary(current)}
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="center" className="w-[min(92vw,320px)] p-1">
            {options.map((option, idx) => (
              <React.Fragment key={option.id ?? 'base'}>
                {idx > 0 && <div className="mx-2 h-px bg-white/10" />}
                <DropdownMenuItem
                  onSelect={() => onSelect(option.id ? profiles.find((profile) => profile.id === option.id) ?? null : null)}
                  className="flex items-center gap-3 py-2"
                >
                  <ProfileAvatar imagePath={option.profile_image_url} hasVideo={!!option.video_url} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words text-[14px] font-medium leading-snug">{option.label}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] leading-tight opacity-80">
                      <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{option.cv_url ? 'CV' : 'Inget CV'}</span>
                      <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />{option.video_url ? 'Video' : 'Ingen video'}</span>
                      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{option.profile_image_url ? 'Bild' : 'Ingen bild'}</span>
                    </span>
                  </span>
                  {option.id === selectedId && <Check className="h-4 w-4 shrink-0" />}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default CandidateProfilePicker;
