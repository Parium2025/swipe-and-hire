import { FileText, Image as ImageIcon, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageAttachmentDisplayProps {
  url: string;
  type: string;
  name: string;
  isOwn: boolean;
}

export function MessageAttachmentDisplay({
  url,
  type,
  name,
  isOwn,
}: MessageAttachmentDisplayProps) {
  const handleOpen = () => {
    window.open(url, '_blank');
  };

  if (type === 'image') {
    return (
      <button 
        onClick={handleOpen}
        className="relative rounded-lg overflow-hidden max-w-[200px] group"
      >
        <img 
          src={url} 
          alt={name}
          className="w-full h-auto rounded-lg"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ExternalLink className="h-6 w-6 text-white" />
        </div>
      </button>
    );
  }

  // Document attachment
  return (
    <button
      onClick={handleOpen}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        isOwn 
          ? "bg-blue-500/20 hover:bg-blue-500/30" 
          : "bg-white/10 hover:bg-white/20"
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-blue-500/30 flex items-center justify-center flex-shrink-0">
        <FileText className="h-5 w-5 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-white text-sm font-medium truncate">{name}</p>
        <p className="text-white/60 text-xs">Dokument • Tryck för att öppna</p>
      </div>
      <Download className="h-4 w-4 text-white/40 flex-shrink-0" />
    </button>
  );
}
