import { Badge } from '@/components/ui/badge';
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
        <div className="relative">
          {companyLogoUrl ? (
            <div 
              className="w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer"
              onClick={onUploadClick}
            >
              <img 
                src={companyLogoUrl} 
                alt="Företagslogga" 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div 
              className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-white/5 border border-dashed border-white flex items-center justify-center cursor-pointer"
              onClick={onUploadClick}
            >
              <div className="text-2xl md:text-3xl font-semibold text-white">
                {companyName ? 
                  companyName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) : 
                  'HM'
                }
              </div>
            </div>
          )}

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
