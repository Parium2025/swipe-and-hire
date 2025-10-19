import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Globe, 
  Users, 
  MapPin, 
  Star, 
  Loader2, 
  Briefcase,
  MessageSquare
} from 'lucide-react';

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
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [reviews, setReviews] = useState<CompanyReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchCompanyData();
      fetchReviews();
    }
  }, [user?.id]);

  // Real-time lyssning för företagsprofil
  useEffect(() => {
    if (!user?.id) return;

    const profileChannel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile updated:', payload);
          setCompany(payload.new as CompanyProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  // Real-time lyssning för recensioner
  useEffect(() => {
    if (!user?.id) return;

    const reviewsChannel = supabase
      .channel('reviews-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${user.id}`
        },
        () => {
          console.log('New review added');
          fetchReviews();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${user.id}`
        },
        () => {
          console.log('Review updated');
          fetchReviews();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${user.id}`
        },
        () => {
          console.log('Review deleted');
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewsChannel);
    };
  }, [user?.id]);

  const fetchCompanyData = async () => {
    if (!user?.id) return;

    try {
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
        return;
      }

      setCompany(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('company_reviews')
        .select('*')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      // Fetch user profiles separately for non-anonymous reviews
      const reviewsWithProfiles = await Promise.all(
        (data || []).map(async (review) => {
          if (review.is_anonymous || !review.user_id) {
            return { ...review, profiles: undefined };
          }

          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', review.user_id)
            .maybeSingle();

          return { ...review, profiles: profileData || undefined };
        })
      );

      setReviews(reviewsWithProfiles as CompanyReview[]);
    } catch (error) {
      console.error('Error:', error);
    }
  };

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
          <Building2 className="h-12 w-12 text-white/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Företagsinformation saknas
          </h3>
          <p className="text-white/70">
            Fyll i din företagsprofil för att se recensioner
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Recensioner</h1>
        <p className="text-sm text-white">
          Se hur ditt företag upplevs av jobbsökare
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
        {/* Header med Logo och Namn */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={company.company_logo_url} alt={company.company_name} />
              <AvatarFallback>
                <Building2 className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold text-white">{company.company_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-white">
                  {averageRating} ({reviews.length} {reviews.length === 1 ? 'recension' : 'recensioner'})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Översikt */}
        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-base text-white">Översikt</h3>
          <p className="text-sm text-white">
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
                  <p className="text-xs font-medium text-white">Webbplats</p>
                  <a 
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-white hover:underline"
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
                  <p className="text-xs font-medium text-white">Bransch</p>
                  <p className="text-xs text-white">{company.industry}</p>
                </div>
              </div>
            )}

            {company.employee_count && (
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-white flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-white">Företagsstorlek</p>
                  <p className="text-xs text-white">{company.employee_count}</p>
                </div>
              </div>
            )}

            {company.address && (
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-white flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-white">Huvudkontor</p>
                  <p className="text-xs text-white">{company.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-6 bg-white/10" />

        {/* Kommentarer */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-white" />
            <h3 className="font-semibold text-base text-white">Kommentarer</h3>
          </div>

          {/* Informationstext för arbetsgivare */}
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-xs text-white text-center">
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
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-white/20 text-white text-xs">
                          {review.is_anonymous
                            ? "A"
                            : review.profiles?.first_name?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm text-white">
                          {review.is_anonymous
                            ? "Anonym"
                            : `${review.profiles?.first_name || ""} ${
                                review.profiles?.last_name?.[0] || ""
                              }.`}
                        </p>
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating)}
                          <span className="text-xs text-white/70">
                            {new Date(review.created_at).toLocaleDateString("sv-SE")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-white mt-2">{review.comment}</p>
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
