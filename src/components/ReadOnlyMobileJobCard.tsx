import { memo, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Users, MapPin, Calendar, Building2, Heart, Timer, CheckCircle } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { getTimeRemaining } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { imageCache } from '@/lib/imageCache';

interface ReadOnlyMobileJobCardProps {
  job: {
    id: string;
    title: string;
    location: string;
    employment_type?: string;
    is_active: boolean;
    views_count: number;
    applications_count: number;
    created_at: string;
    expires_at?: string;
    job_image_url?: string;
    company_name?: string;
    profiles?: {
      company_name: string | null;
    };
    employer_profile?: {
      first_name: string;
      last_name: string;
    };
  };
  hasApplied?: boolean;
}

export const ReadOnlyMobileJobCard = memo(({ job, hasApplied = false }: ReadOnlyMobileJobCardProps) => {
  const navigate = useNavigate();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();

  // Resolve the raw storage path to a public URL (synchronous, stable)
  const resolvedUrl = useMemo(() => {
    if (!job.job_image_url) return null;
    if (job.job_image_url.startsWith('http')) return job.job_image_url;
    const { data } = supabase.storage.from('job-images').getPublicUrl(job.job_image_url);
    return data?.publicUrl || null;
  }, [job.job_image_url]);

  // Use imageCache for blob caching — survives navigation
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => {
    if (!resolvedUrl) return null;
    return imageCache.getCachedUrl(resolvedUrl) || resolvedUrl;
  });

  useEffect(() => {
    if (!resolvedUrl) {
      setDisplayUrl(null);
      return;
    }
    // If already in blob cache, use immediately
    const cached = imageCache.getCachedUrl(resolvedUrl);
    if (cached) {
      setDisplayUrl(cached);
      return;
    }
    // Load into blob cache in background
    imageCache.loadImage(resolvedUrl)
      .then(blobUrl => setDisplayUrl(blobUrl))
      .catch(() => setDisplayUrl(resolvedUrl)); // Fallback to network URL
  }, [resolvedUrl]);

  // Get company name from either direct property or profiles join
  const companyName = job.company_name || job.profiles?.company_name || 'Okänt företag';
  const isSaved = isJobSaved(job.id);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaveJob(job.id);
  };

  const handleCardClick = () => {
    navigate(`/job-view/${job.id}`);
  };

  return (
    <Card 
      className="group bg-white/5 backdrop-blur-sm border-white/20 overflow-hidden cursor-pointer transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
      onClick={handleCardClick}
    >
      {/* Job Image - blob-cached for instant display on re-navigation */}
      {displayUrl && (
        <div className="relative w-full h-48 overflow-hidden">
          <img
            src={displayUrl}
            alt={`${job.title} hos ${companyName}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Status Badge on image */}
          <div className="absolute top-3 right-3">
            <Badge
              variant={job.is_active ? "default" : "secondary"}
              className={`text-xs ${job.is_active ? "bg-green-500/90 text-white border-green-600" : "bg-gray-500/90 text-white border-gray-600"}`}
            >
              {job.is_active ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title & Company */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-white line-clamp-2 leading-tight">
            {job.title}
          </h3>
          <div className="flex items-center gap-2 text-sm text-white">
            <Building2 className="h-4 w-4 flex-shrink-0 text-white" />
            <span className="font-medium text-white">{companyName}</span>
          </div>
        </div>

        {/* Employment Type Badge */}
        {job.employment_type && (
          <Badge 
            variant="glass" 
            className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-blur-sm hover:backdrop-brightness-110"
          >
            {getEmploymentTypeLabel(job.employment_type)}
          </Badge>
        )}

        {/* Status Badge (if no image) */}
        {!displayUrl && (
          <div>
            <Badge
              variant={job.is_active ? "default" : "secondary"}
              className={`text-xs ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
            >
              {job.is_active ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          </div>
        )}

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-white">
          <MapPin className="h-4 w-4 flex-shrink-0 text-white" />
          <span className="truncate text-white">{job.location}</span>
        </div>

        {/* Stats Row with Save Button */}
        <div className="flex items-center gap-4 text-xs text-white pt-2 border-t border-white/10">
          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span>{job.views_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{job.applications_count || 0} sökande</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(job.created_at).toLocaleDateString('sv-SE', { 
                day: 'numeric', 
                month: 'short'
              })}
            </span>
          </div>
          {/* Visa "dagar kvar" eller "Utgången" */}
          {(() => {
            const { text, isExpired } = getTimeRemaining(job.created_at, job.expires_at);
            if (isExpired) {
              return (
                <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-blur-sm hover:backdrop-brightness-110">
                  Utgången
                </Badge>
              );
            }
            return (
              <Badge variant="glass" className="text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-white/15 hover:border-white/50 hover:backdrop-blur-sm hover:backdrop-brightness-110">
                <Timer className="h-3 w-3 mr-1" />
                {text} kvar
              </Badge>
            );
          })()}
          {/* Visa "Redan sökt" badge på mobil */}
          {hasApplied && (
            <Badge variant="glass" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs transition-all duration-300 group-hover:backdrop-brightness-90 hover:bg-green-500/30 hover:border-green-500/50">
              <CheckCircle className="h-3 w-3 mr-1" />
              Redan sökt
            </Badge>
          )}
          <Button
            variant="glass"
            size="icon"
            onClick={handleSaveClick}
            aria-label={isSaved ? "Ta bort från sparade" : "Spara jobb"}
            className="ml-auto h-10 w-10 min-h-touch min-w-touch p-0 rounded-full transition-all duration-300 group-hover:backdrop-brightness-90 active:scale-95 active:bg-white/20"
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-400 text-red-400' : ''}`} />
          </Button>
        </div>
      </div>
    </Card>
  );
});

ReadOnlyMobileJobCard.displayName = 'ReadOnlyMobileJobCard';
