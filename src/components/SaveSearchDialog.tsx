import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bookmark, Bell, Loader2 } from 'lucide-react';
import { SearchCriteria } from '@/hooks/useSavedSearches';

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: SearchCriteria;
  onSave: (name: string, criteria: SearchCriteria) => Promise<any>;
}

export function SaveSearchDialog({ 
  open, 
  onOpenChange, 
  criteria,
  onSave 
}: SaveSearchDialogProps) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Generate a default name based on criteria
  const generateDefaultName = () => {
    const parts: string[] = [];
    if (criteria.search_query) parts.push(criteria.search_query);
    if (criteria.city) parts.push(criteria.city);
    if (criteria.category) parts.push(criteria.category);
    if (criteria.employment_types?.length) {
      parts.push(criteria.employment_types.join(', '));
    }
    return parts.length > 0 ? parts.slice(0, 2).join(' - ') : 'Min sökning';
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      const result = await onSave(name.trim(), criteria);
      if (result) {
        setName('');
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Set default name when opening
      setName(generateDefaultName());
    }
    onOpenChange(isOpen);
  };

  // Build criteria summary
  const criteriaSummary: string[] = [];
  if (criteria.search_query) criteriaSummary.push(`"${criteria.search_query}"`);
  if (criteria.city) criteriaSummary.push(criteria.city);
  if (criteria.county) criteriaSummary.push(criteria.county);
  if (criteria.category) criteriaSummary.push(criteria.category);
  if (criteria.employment_types?.length) {
    criteriaSummary.push(criteria.employment_types.join(', '));
  }
  if (criteria.salary_min || criteria.salary_max) {
    const min = criteria.salary_min ? `${criteria.salary_min.toLocaleString()} kr` : '';
    const max = criteria.salary_max ? `${criteria.salary_max.toLocaleString()} kr` : '';
    criteriaSummary.push(`Lön: ${min}${min && max ? ' - ' : ''}${max}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900/95 backdrop-blur-xl border-white/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bookmark className="h-5 w-5 text-blue-400" />
            Spara sökning
          </DialogTitle>
          <DialogDescription className="text-white">
            Få notiser när nya jobb matchar dina kriterier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-name" className="text-white">
              Namn på sökningen
            </Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Utvecklarjobb i Stockholm"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleSave();
                }
              }}
            />
          </div>

          {criteriaSummary.length > 0 && (
            <div className="space-y-2">
              <Label className="text-white text-sm">Sökkriterier</Label>
              <div className="flex flex-wrap gap-2">
                {criteriaSummary.map((item, i) => (
                  <span 
                    key={i}
                    className="px-2 py-1 text-xs rounded-full bg-white/10 text-white border border-white/10"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Bell className="h-5 w-5 text-white mt-0.5 shrink-0" />
            <div className="text-sm text-white">
              <p className="font-medium text-white mb-1">Realtidsnotiser</p>
              <p>Du får en notis direkt när nya jobb publiceras som matchar din sökning.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4 mr-2" />
                Spara sökning
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
