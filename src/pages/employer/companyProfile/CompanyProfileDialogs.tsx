import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertDialogContentNoFocus } from "@/components/ui/alert-dialog-no-focus";
import { AlertTriangle, Trash2 } from 'lucide-react';
import { SocialMediaLink } from './types';

const getPlatformLabel = (platform: SocialMediaLink['platform']) => {
  const labels: Record<string, string> = {
    linkedin: 'LinkedIn',
    twitter: 'Twitter/X',
    instagram: 'Instagram',
    annat: 'Annat',
  };
  return labels[platform] || 'Okänd plattform';
};

interface DeleteSocialLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkToDelete: { link: SocialMediaLink; index: number } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteSocialLinkDialog = ({ open, onOpenChange, linkToDelete, onConfirm, onCancel }: DeleteSocialLinkDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContentNoFocus 
      className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
    >
      <AlertDialogHeader className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-red-500/20 p-2 rounded-full">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
            Ta bort social medier-länk
          </AlertDialogTitle>
        </div>
        <AlertDialogDescription className="text-white text-sm leading-relaxed">
          {linkToDelete && (
            <>
              Är du säker på att du vill ta bort länken till <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">{getPlatformLabel(linkToDelete.link.platform)}</span>? Denna åtgärd går inte att ångra.
            </>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
        <AlertDialogCancel 
          onClick={onCancel}
          className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
        >
          Avbryt
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          variant="destructiveSoft"
          className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Ta bort
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContentNoFocus>
  </AlertDialog>
);

interface DeleteLogoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteLogoDialog = ({ open, onOpenChange, onConfirm, onCancel }: DeleteLogoDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContentNoFocus 
      className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
    >
      <AlertDialogHeader className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-red-500/20 p-2 rounded-full">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
            Ta bort företagslogga
          </AlertDialogTitle>
        </div>
        <AlertDialogDescription className="text-white text-sm leading-relaxed">
          Är du säker på att du vill ta bort företagsloggan? (Glöm inte att spara åtgärden.)
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
        <AlertDialogCancel 
          onClick={onCancel}
          className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
        >
          Avbryt
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          variant="destructiveSoft"
          className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Ta bort
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContentNoFocus>
  </AlertDialog>
);
