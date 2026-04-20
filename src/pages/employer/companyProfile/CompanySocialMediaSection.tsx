import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, ExternalLink, ChevronDown, Check, Plus, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SocialMediaLink, SOCIAL_PLATFORMS } from './types';

interface CompanySocialMediaSectionProps {
  links: SocialMediaLink[];
  onLinksChange: (links: SocialMediaLink[]) => void;
  onRemoveLinkClick: (index: number) => void;
}

const getPlatformIcon = (platform: SocialMediaLink['platform']) => {
  const platformData = SOCIAL_PLATFORMS.find(p => p.value === platform);
  if (!platformData) return Globe;
  return platformData.icon;
};

const getPlatformLabel = (platform: SocialMediaLink['platform']) => {
  const platformData = SOCIAL_PLATFORMS.find(p => p.value === platform);
  return platformData?.label || 'Okänd plattform';
};

const validateUrl = (url: string, platform: string) => {
  if (!url.trim()) return true;
  
  try {
    const validUrl = new URL(url);
    
    if (platform === 'linkedin') {
      return validUrl.hostname === 'www.linkedin.com' || validUrl.hostname === 'linkedin.com';
    }
    
    if (platform === 'twitter') {
      return validUrl.hostname === 'www.twitter.com' || validUrl.hostname === 'twitter.com' || 
             validUrl.hostname === 'www.x.com' || validUrl.hostname === 'x.com';
    }
    
    if (platform === 'instagram') {
      return validUrl.hostname === 'www.instagram.com' || validUrl.hostname === 'instagram.com';
    }
    
    return true;
  } catch {
    return false;
  }
};

export const CompanySocialMediaSection = ({ links, onLinksChange, onRemoveLinkClick }: CompanySocialMediaSectionProps) => {
  const [newSocialLink, setNewSocialLink] = useState({
    platform: '' as SocialMediaLink['platform'] | '',
    url: ''
  });
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);
  const platformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) {
        setPlatformMenuOpen(false);
      }
    };
    
    if (platformMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [platformMenuOpen]);

  const addSocialLink = () => {
    if (!newSocialLink.platform || !newSocialLink.url.trim()) {
      toast({
        title: "Ofullständig information",
        description: "Välj en plattform och ange en URL",
        variant: "destructive"
      });
      return;
    }

    if (!validateUrl(newSocialLink.url, newSocialLink.platform)) {
      toast({
        title: "Ogiltig URL",
        description: `Ange en giltig URL för ${SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label}`,
        variant: "destructive"
      });
      return;
    }

    if (newSocialLink.platform !== 'annat') {
      const existingPlatform = links.find(link => link.platform === newSocialLink.platform);
      if (existingPlatform) {
        toast({
          title: "Plattform finns redan",
          description: "Du har redan lagt till denna plattform. Ta bort den först om du vill ändra länken.",
          variant: "destructive"
        });
        return;
      }
    }

    onLinksChange([...links, newSocialLink as SocialMediaLink]);
    setNewSocialLink({ platform: '', url: '' });
    
    toast({
      title: "Länk tillagd",
      description: `${SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label}-länken har lagts till. Glöm inte att spara!`,
    });
  };

  return (
    <div className="border-t border-white/10 pt-5 space-y-4">
      <div>
        <h4 className="text-base font-semibold text-white mb-1">Sociala medier</h4>
        <p className="text-sm text-white">Lägg till företagets sociala medier-profiler</p>
      </div>

      {links.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-white">Företagets sociala medier</Label>
          {links.map((link, index) => {
            const Icon = getPlatformIcon(link.platform);
            return (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-2 gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon className="h-4 w-4 text-white flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-medium">{getPlatformLabel(link.platform)}</div>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 break-all max-w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="truncate max-w-xs sm:max-w-sm md:max-w-md">
                        {link.url}
                      </span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveLinkClick(index);
                  }}
                  className="border-destructive/40 bg-destructive/20 text-white transition-all duration-300 md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4 md:space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-3">
          <div className="relative" ref={platformRef}>
            <div
              onClick={() => setPlatformMenuOpen(!platformMenuOpen)}
              className={`flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-3 py-2 h-11 cursor-pointer hover:border-white/40 transition-colors ${platformMenuOpen ? 'border-white/50' : ''}`}
            >
              <span className="text-sm text-white truncate">
                {newSocialLink.platform ? SOCIAL_PLATFORMS.find(p => p.value === newSocialLink.platform)?.label : 'Välj plattform'}
              </span>
              <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
            </div>
            
            {platformMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 z-50 glass-panel rounded-md mb-1">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <button
                      key={platform.value}
                      type="button"
                      onClick={() => {
                        setNewSocialLink(prev => ({ ...prev, platform: platform.value as SocialMediaLink['platform'] }));
                        setPlatformMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-white/20 text-white text-sm border-b border-white/10 last:border-b-0 transition-colors flex items-center gap-3"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 font-medium">{platform.label}</span>
                      {newSocialLink.platform === platform.value && (
                        <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Input
            placeholder="Klistra in din länk"
            value={newSocialLink.url}
            onChange={(e) => setNewSocialLink(prev => ({ ...prev, url: e.target.value }))}
            className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 text-sm"
          />

          <Button
            type="button"
            onClick={addSocialLink}
            disabled={!newSocialLink.platform || !newSocialLink.url.trim()}
            variant="glass"
            className="w-full h-11 !min-h-0 text-sm"
          >
            Lägg till
            <Plus className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export { getPlatformLabel, validateUrl };
