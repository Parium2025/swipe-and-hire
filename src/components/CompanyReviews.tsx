import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Building, Globe, Users, MapPin, Star, Loader2 } from 'lucide-react';

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
  const [averageRating, setAverageRating] = useState<number>(0);

  useEffect(() => {
    if (user?.id) {
      fetchCompanyData();
      fetchReviews();
    }
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
      
      // Calculate average rating
      if (data && data.length > 0) {
        const avg = data.reduce((sum, review) => sum + (review.rating || 0), 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-white/30'
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
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-8 text-center">
            <Building className="h-12 w-12 text-white/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Företagsinformation saknas
            </h3>
            <p className="text-white/70">
              Fyll i din företagsprofil för att se recensioner
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Recensioner</h1>
        <p className="text-white/90 mt-1">
          Se hur ditt företag upplevs av jobbsökare
        </p>
      </div>

      {/* Company Profile Card */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-white/20">
              <AvatarImage src={company.company_logo_url || ''} />
              <AvatarFallback className="bg-white/20 text-white text-xl">
                {company.company_name?.slice(0, 2).toUpperCase() || 'AB'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl text-white mb-2">
                {company.company_name}
              </CardTitle>
              {company.company_description && (
                <p className="text-white/80 text-sm mb-3">
                  {company.company_description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                {company.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <a 
                      href={company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {company.industry && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span>{company.industry}</span>
                  </div>
                )}
                {company.employee_count && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{company.employee_count} anställda</span>
                  </div>
                )}
                {company.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{company.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Reviews Section */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-white">
              Recensioner ({reviews.length})
            </CardTitle>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                {renderStars(averageRating)}
                <span className="text-white font-semibold ml-2">
                  {averageRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <Star className="h-12 w-12 text-white/30 mx-auto mb-3" />
              <p className="text-white/70">
                Inga recensioner än. När jobbsökare recenserar ditt företag kommer de att visas här.
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id}>
                <div className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border border-white/20">
                    <AvatarFallback className="bg-white/20 text-white text-sm">
                      {review.is_anonymous 
                        ? 'A'
                        : (review.profiles?.first_name?.charAt(0) || '?').toUpperCase()
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-white">
                          {review.is_anonymous 
                            ? 'Anonym' 
                            : `${review.profiles?.first_name || ''} ${review.profiles?.last_name || ''}`.trim() || 'Okänd'
                          }
                        </p>
                        <p className="text-xs text-white/60">
                          {new Date(review.created_at).toLocaleDateString('sv-SE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-white/80 text-sm">
                      {review.comment}
                    </p>
                  </div>
                </div>
                <Separator className="bg-white/10 mt-4" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyReviews;
