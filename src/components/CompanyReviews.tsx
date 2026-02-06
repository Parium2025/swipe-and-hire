import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, 
  Globe, 
  Users, 
  MapPin, 
  Star, 
  Loader2, 
  Briefcase,
  MessageSquare,
  Linkedin,
  Twitter,
  Instagram,
  ExternalLink
} from 'lucide-react';

interface SocialMediaLink {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'annat';
  url: string;
}

interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string;
  company_description?: string;
  company_logo_url?: string;
  website?: string;
  industry?: string;
  employee_count?: string;
  address?: string;
  social_media_links?: SocialMediaLink[];
}

interface CompanyReview {
  id: string;
  company_id: string;
  user_id: string;
  rating: number;
  comment: string;
  is_anonymous: boolean;
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

const CompanyReviews = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch company data with React Query
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching company data:', error);
        toast({
          title: "Fel",
          description: "Kunde inte hämta företagsinformation",
          variant: "destructive"
        });
        return null;
      }

      return data ? {
        ...data,
        // Map the correct field names from profiles table
        social_media_links: (data.social_media_links as unknown as SocialMediaLink[]) || []
      } as CompanyProfile : null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch reviews with React Query - using JOIN to avoid N+1 queries
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['company-reviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch reviews without JOIN since there's no FK relationship
      const { data, error } = await supabase
        .from('company_reviews')
        .select('*')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return [];
      }

      return (data || []) as CompanyReview[];
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const loading = companyLoading || reviewsLoading;


  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "0";

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg p-8 text-center">
          <Building2 className="h-12 w-12 text-white mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Företagsinformation saknas
          </h3>
          <p className="text-white">
            Fyll i din företagsprofil för att se recensioner
          </p>
        </div>
      </div>
    );
  }

  return (
     <div className="space-y-8 responsive-container animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-1">Recensioner</h1>
        <p className="text-sm text-white">
          Se hur ditt företag upplevs av jobbsökare
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
        {/* Header med Logo och Namn */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-transparent">
              <AvatarImage src={company.company_logo_url || ''} alt={company.company_name} />
              <AvatarFallback className="bg-transparent" delayMs={150}>
                <Building2 className="h-8 w-8 text-white" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold text-white">{company.company_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Star className="h-3.5 w-3.5 fill-transparent text-white stroke-white stroke-[1.5]" />
                <span className="text-sm text-white">
                  {averageRating} ({reviews.length} {reviews.length === 1 ? 'recension' : 'recensioner'})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Översikt */}
        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-base text-white">Översikt</h3>
          <p className="text-sm text-white whitespace-pre-line">
            {company.company_description || "Ingen beskrivning tillgänglig."}
          </p>
        </div>

        <Separator className="my-6 bg-white/10" />

        {/* Företagsinformation */}
        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-base text-white">Företagsinformation</h3>
          
          <div className="grid gap-2.5">
            {company.website && (
              <div className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 text-white flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Webbplats</p>
                  <a 
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:underline"
                  >
                    {company.website}
                  </a>
                </div>
              </div>
            )}

            {company.industry && (
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-white flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Bransch</p>
                  <p className="text-sm text-white">{company.industry}</p>
                </div>
              </div>
            )}

            {company.employee_count && (
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-white flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Företagsstorlek</p>
                  <p className="text-sm text-white">{company.employee_count}</p>
                </div>
              </div>
            )}

            {company.address && (
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-white flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Huvudkontor</p>
                  <p className="text-sm text-white">{company.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sociala medier */}
        {company.social_media_links && company.social_media_links.length > 0 && (
          <>
            <Separator className="my-6 bg-white/10" />
            
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-base text-white">Sociala medier</h3>
              
              <div className="grid gap-2.5">
                {company.social_media_links.map((link, index) => {
                  const getPlatformIcon = () => {
                    switch(link.platform) {
                      case 'linkedin': return Linkedin;
                      case 'twitter': return Twitter;
                      case 'instagram': return Instagram;
                      default: return Globe;
                    }
                  };
                  
                  const getPlatformLabel = () => {
                    switch(link.platform) {
                      case 'linkedin': return 'LinkedIn';
                      case 'twitter': return 'Twitter/X';
                      case 'instagram': return 'Instagram';
                      default: return 'Webbsida';
                    }
                  };
                  
                  const Icon = getPlatformIcon();
                  
                  return (
                    <div key={index} className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-white flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{getPlatformLabel()}</p>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Separator className="my-6 bg-white/10" />

        {/* Kommentarer */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-white" />
            <h3 className="font-semibold text-base text-white">Kommentarer</h3>
          </div>

          {/* Informationstext för arbetsgivare */}
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-sm text-white text-center">
              (Här lämnar jobbsökarna kommentarer om de vill samt betyg)
            </p>
          </div>

          {/* Lista med kommentarer */}
          <div className="space-y-3 mt-4">
            {reviews.length === 0 ? (
              <p className="text-center text-white py-6 text-sm">
                Inga kommentarer än
              </p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="border border-white/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-white">
                        {review.is_anonymous
                          ? "Anonym"
                          : `${review.profiles?.first_name || ""} ${
                              review.profiles?.last_name?.[0] || ""
                            }.`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {renderStars(review.rating)}
                        <span className="text-sm text-white">
                          {new Date(review.created_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-white mt-2">
                      <span className="text-white/70">Kommentar:</span> {review.comment}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyReviews;
