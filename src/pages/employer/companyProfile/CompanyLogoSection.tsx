import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2 } from 'lucide-react';

interface CompanyLogoSectionProps {
  companyLogoUrl: string;
  companyName: string;
  isUploadingLogo: boolean;
  onUploadClick: () => void;
  onEditExistingLogo: () => void;
  onLogoDelete: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// Generate up to 2 initials from the company name (first letter of first 2 words).
const getCompanyInitials = (name: string): string => {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
  return initials || '?';
};

export const CompanyLogoSection = ({
  companyLogoUrl,
  companyName,
  isUploadingLogo,
  onUploadClick,
  onEditExistingLogo,
  onLogoDelete,
  onFileChange,
}: CompanyLogoSectionProps) => {
  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Företagslogga</h1>
        <p className="text-sm text-white mt-1">Ladda upp din företagslogga för att bygga kännedom och förtroende</p>
      </div>

      <div className="flex flex-col items-center space-y-4 py-6">
        {/* Avatar – matchar profilbildens stil exakt */}
        <div className="relative">
          <div className="cursor-pointer" onClick={onUploadClick}>
            <Avatar
              key={companyLogoUrl || 'no-company-logo'}
              className="h-32 w-32 border-4 border-white/10"
            >
              <AvatarImage
                src={companyLogoUrl || ''}
                alt="Företagslogga"
                className="object-cover"
              />
              <AvatarFallback
                className="text-4xl font-semibold bg-white/20 text-white"
                delayMs={150}
              >
                {getCompanyInitials(companyName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {companyLogoUrl && !isUploadingLogo && (
            <button
              type="button"
              aria-label="Ta bort företagslogga"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLogoDelete();
              }}
              className="absolute -top-3 -right-3 z-20 pointer-events-auto rounded-full border border-destructive/40 bg-destructive/20 p-2 text-white shadow-lg transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-2 text-center">
          <label
            htmlFor="logo-upload"
            className="text-white cursor-pointer hover:text-white transition-colors text-center text-sm"
          >
            Klicka för att ladda upp • Max 5MB
          </label>

          {isUploadingLogo ? (
            <div className="flex flex-col items-center space-y-2">
              <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-full">
                <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                Laddar upp...
              </Badge>
            </div>
          ) : companyLogoUrl ? (
            <div className="flex flex-col items-center space-y-2">
              <Badge variant="outline" className="bg-white/20 text-white border-white/20 px-3 py-1 rounded-full">
                Bild uppladdad!
              </Badge>
              <button
                type="button"
                onClick={onEditExistingLogo}
                className="bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-white/50 px-4 py-1.5 text-sm font-medium rounded-full transition-colors"
              >
                Anpassa din bild
              </button>
            </div>
          ) : null}
        </div>

        <input
          id="logo-upload"
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
          disabled={isUploadingLogo}
        />
      </div>
    </>
  );
};
