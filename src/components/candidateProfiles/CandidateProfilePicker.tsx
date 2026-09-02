import React from 'react';
import { Check, ChevronDown, FileText, Video, Image as ImageIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

/** Val av kandidatprofil i ansökningsformuläret (ljus yta som resten av formuläret). */
export function CandidateProfilePicker({ profiles, selectedId, onSelect, baseProfile, dark = false, selectionReset = false }: Props) {
  const selected = profiles.find((profile) => profile.id === selectedId) ?? null;
  const current = selected ?? baseProfile ?? { label: 'Min profil', cv_url: null, profile_image_url: null, video_url: null };
  const options = [{ id: null, label: 'Min profil', ...baseProfile }, ...profiles];

  const MediaStatus = ({ profile }: { profile: typeof current }) => (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${dark ? 'text-white' : 'text-muted-foreground'}`}>
      <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{profile.cv_url ? 'CV' : 'Inget CV'}</span>
      <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />{profile.video_url ? 'Video' : 'Ingen video'}</span>
      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{profile.profile_image_url ? 'Bild' : 'Ingen bild'}</span>
    </span>
  );

  return (
    <div className="w-full space-y-1.5">
      {selectionReset && <p role="status" className={`text-xs ${dark ? 'text-white' : 'text-muted-foreground'}`}>Den valda profilen finns inte längre. Standardprofilen har valts.</p>}
      {profiles.length === 0 ? (
        <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${dark ? 'border-white/15 bg-white/5' : 'border-border bg-muted/30'}`}>
          <span className={`inline-flex min-w-0 items-center gap-2 text-sm ${dark ? 'text-white' : 'text-foreground'}`}><User className="h-4 w-4 shrink-0" />Du söker med: <strong className="truncate">Min profil</strong></span>
          <MediaStatus profile={current} />
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className={`h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left ${dark ? 'border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white' : ''}`}>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm"><User className="h-4 w-4 shrink-0" /><span>Du söker med:</span> <strong className="truncate">{current.label}</strong></span>
                <MediaStatus profile={current} />
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-[min(92vw,360px)]">
            {options.map((option) => {
              const id = 'id' in option ? option.id : null;
              const active = id === selectedId;
              return (
                <DropdownMenuItem key={id ?? 'base'} onSelect={() => onSelect(id ? profiles.find((profile) => profile.id === id) ?? null : null)} className="items-start gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium">{option.label}</span>
                    <MediaStatus profile={option} />
                  </span>
                  {active && <Check className="mt-0.5 h-4 w-4 shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default CandidateProfilePicker;
