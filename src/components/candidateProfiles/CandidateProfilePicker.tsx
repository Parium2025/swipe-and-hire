import React from 'react';
import { Check, FileText, Video, Image as ImageIcon, User } from 'lucide-react';
import type { CandidateProfile } from '@/hooks/useCandidateProfiles';

interface Props {
  profiles: CandidateProfile[];
  selectedId: string | null;
  onSelect: (profile: CandidateProfile | null) => void;
}

/** Val av kandidatprofil i ansökningsformuläret (ljus yta som resten av formuläret). */
export function CandidateProfilePicker({ profiles, selectedId, onSelect }: Props) {
  if (profiles.length === 0) return null;

  const Option = ({
    active, title, meta, onClick,
  }: { active: boolean; title: string; meta: React.ReactNode; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        active ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-gray-900">{title}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">{meta}</div>
        </div>
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            active ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
          }`}
        >
          {active && <Check className="h-3.5 w-3.5 text-white" />}
        </span>
      </div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-gray-900">Vilken profil vill du söka med?</p>
        <p className="text-sm text-gray-600">
          Den valda profilens CV, video och bild sparas med ansökan. Senare ändringar påverkar inte den här ansökan.
        </p>
      </div>

      <div className="space-y-2">
        <Option
          active={selectedId === null}
          title="Min vanliga profil"
          meta={<span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> CV, video och bild från kontot</span>}
          onClick={() => onSelect(null)}
        />
        {profiles.map((p) => (
          <Option
            key={p.id}
            active={selectedId === p.id}
            title={p.label}
            onClick={() => onSelect(p)}
            meta={
              <>
                <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{p.cv_url ? 'CV' : 'Inget CV'}</span>
                <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />{p.video_url ? 'Video' : 'Ingen video'}</span>
                <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{p.profile_image_url ? 'Bild' : 'Ingen bild'}</span>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}

export default CandidateProfilePicker;
