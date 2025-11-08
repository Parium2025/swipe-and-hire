import { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, MapPin, Calendar, Building2 } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { supabase } from '@/integrations/supabase/client';

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
}

export const ReadOnlyMobileJobCard = memo(({ job }: ReadOnlyMobileJobCardProps) => {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Get company name from either direct property or profiles join
  const companyName = job.company_name || job.profiles?.company_name || 'Okänt företag';

  // Load and cache job image
  useEffect(() => {
    const loadJobImage = async () => {
      if (!job.job_image_url) {
        setImageUrl(null);
        return;
      }

      try {
        // If it's already a full URL, use it directly
        if (job.job_image_url.startsWith('http')) {
          setImageUrl(job.job_image_url);
          return;
        }

        // Otherwise, get signed URL from Supabase storage
        const { data, error } = await supabase.storage
          .from('job-images')
          .createSignedUrl(job.job_image_url, 3600); // 1 hour cache

        if (!error && data?.signedUrl) {
          setImageUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error loading job image:', err);
        setImageUrl(null);
      }
    };

    loadJobImage();
  }, [job.job_image_url]);

  const handleCardClick = () => {
    navigate(`/job-view/${job.id}`);
  };

  return (
    <Card 
      className="bg-white/5 backdrop-blur-sm border-white/20 overflow-hidden cursor-pointer transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
      onClick={handleCardClick}
    >
      {/* Job Image - Simplex style */}
      {imageUrl && (
        <div className="relative w-full h-48 overflow-hidden">
          <img
            src={imageUrl}
            alt={`${job.title} hos ${companyName}`}
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
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
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{companyName}</span>
          </div>
        </div>

        {/* Employment Type Badge */}
        {job.employment_type && (
          <Badge 
            variant="secondary" 
            className="text-xs bg-white/10 text-white border-white/20"
          >
            {getEmploymentTypeLabel(job.employment_type)}
          </Badge>
        )}

        {/* Status Badge (if no image) */}
        {!imageUrl && (
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
        <div className="flex items-center gap-2 text-sm text-white/80">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{job.location}</span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs text-white/60 pt-2 border-t border-white/10">
          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span>{job.views_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{job.applications_count || 0}</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(job.created_at).toLocaleDateString('sv-SE', { 
                day: 'numeric', 
                month: 'short'
              })}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
});

ReadOnlyMobileJobCard.displayName = 'ReadOnlyMobileJobCard';
