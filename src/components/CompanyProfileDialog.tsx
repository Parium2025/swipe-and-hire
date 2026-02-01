import * as React from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogContentNoFocus } from "@/components/ui/dialog-no-focus";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Globe, 
  Users, 
  MapPin, 
  Briefcase, 
  Star,
  Send,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyReviewsCache } from "@/hooks/useCompanyReviewsCache";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface CompanyProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface CompanyProfile {
  company_name: string;
  company_logo_url?: string;
  company_description?: string;
  website?: string;
  industry?: string;
  employee_count?: string;
  address?: string;
}

interface CompanyReview {
  id: string;
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

export function CompanyProfileDialog({ open, onOpenChange, companyId }: CompanyProfileDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = React.useState("");
  const [newRating, setNewRating] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  // Use cached reviews for instant load
  const { reviews: cachedReviews, avgRating, reviewCount, refetch: refetchReviews } = useCompanyReviewsCache(open ? companyId : null);

  // Use React Query for company profile with prefetched data
  const { data: company, isLoading: loading } = useQuery<CompanyProfile | null>({
    queryKey: ['company-profile', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("company_name, company_logo_url, company_description, website, industry, employee_count, address")
        .eq("user_id", companyId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId,
    staleTime: 60 * 1000, // 1 minute
  });

  React.useEffect(() => {
    if (open && companyId) {
      getCurrentUser();
    }
  }, [open, companyId]);

  // Real-time lyssning för företagsprofil - invalidate query cache
  React.useEffect(() => {
    if (!open || !companyId) return;

    const profileChannel = supabase
      .channel(`profile-dialog-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${companyId}`
        },
        (payload) => {
          console.log('Profile updated in dialog:', payload);
          // Update the query cache directly with new data
          queryClient.setQueryData(['company-profile', companyId], payload.new as CompanyProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [open, companyId, queryClient]);

  // Real-time lyssning för recensioner - triggers refetch from cache hook
  React.useEffect(() => {
    if (!open || !companyId) return;

    const reviewsChannel = supabase
      .channel(`reviews-dialog-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          console.log('Reviews changed in dialog, refetching cache');
          refetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewsChannel);
    };
  }, [open, companyId, refetchReviews]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  // Reviews are now fetched via useCompanyReviewsCache hook

  const handleSubmitReview = async () => {
    // Check if online before submitting
    if (!navigator.onLine) {
      toast({
        title: "Offline",
        description: "Du måste vara online för att skicka en kommentar",
        variant: "destructive",
      });
      return;
    }

    // Require at least 1 star
    if (newRating < 1) {
      toast({
        title: "Betyg krävs",
        description: "Vänligen välj minst 1 stjärna",
        variant: "destructive",
      });
      return;
    }

    if (!newComment.trim()) {
      toast({
        title: "Kommentar krävs",
        description: "Vänligen skriv en kommentar",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Inte inloggad",
          description: "Du måste vara inloggad för att lämna en kommentar",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("company_reviews")
        .insert({
          company_id: companyId,
          user_id: user.id,
          rating: newRating,
          comment: newComment,
          is_anonymous: isAnonymous,
        });

      if (error) {
        // Hantera duplicatfel
        if (error.code === '23505') {
          toast({
            title: "Du har redan recenserat",
            description: "Du kan bara lämna en recension per företag",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Kommentar skickad",
        description: "Din kommentar har publicerats",
      });

      setNewComment("");
      setNewRating(0);
      setIsAnonymous(false);
      refetchReviews();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Fel",
        description: "Kunde inte skicka kommentaren",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContentNoFocus className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-[hsl(215,100%,12%)] via-[hsl(215,90%,18%)] to-[hsl(215,100%,12%)] border-white/20">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContentNoFocus>
      </Dialog>
    );
  }

  if (!company) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContentNoFocus className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-[hsl(215,100%,12%)] via-[hsl(215,90%,18%)] to-[hsl(215,100%,12%)] border-white/20">
          <div className="flex flex-col items-center justify-center p-8 text-white">
            <Building2 className="h-16 w-16 mb-4 text-white" />
            <p className="text-lg font-medium mb-2">Företagsinformation saknas</p>
            <p className="text-sm text-white text-center">
              Det finns ingen företagsprofil tillgänglig för detta konto.
            </p>
          </div>
        </DialogContentNoFocus>
      </Dialog>
    );
  }

  const averageRating = avgRating?.toFixed(1) || "0";

  const isOwnProfile = currentUserId === companyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus className="max-w-2xl max-h-[90vh] p-0 bg-gradient-to-br from-[hsl(215,100%,12%)] via-[hsl(215,90%,18%)] to-[hsl(215,100%,12%)] border-white/20">
        <ScrollArea className="max-h-[90vh] [&>div>div]:!overflow-y-scroll [&>div>div]:scrollbar-hide">
          <div className="p-6 text-white">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={company.company_logo_url || ''} alt={company.company_name} />
                  <AvatarFallback className="bg-white/20 text-white text-xl font-bold" delayMs={150}>
                    {company.company_name?.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'AB'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-2xl text-white">{company.company_name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-white">
                      {averageRating} ({reviewCount} {reviewCount === 1 ? 'recension' : 'recensioner'})
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Översikt */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-lg text-white">Översikt</h3>
              <p className="text-white">
                {company.company_description || "Ingen beskrivning tillgänglig."}
              </p>
            </div>

            <Separator className="my-6" />

            {/* Företagsinformation */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-lg text-white">Företagsinformation</h3>
              
              <div className="grid gap-3">
                {company.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-white" />
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
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-sm font-medium text-white">Bransch</p>
                      <p className="text-sm text-white">{company.industry}</p>
                    </div>
                  </div>
                )}

                {company.employee_count && (
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-sm font-medium text-white">Företagsstorlek</p>
                      <p className="text-sm text-white">{company.employee_count}</p>
                    </div>
                  </div>
                )}

                {company.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-sm font-medium text-white">Huvudkontor</p>
                      <p className="text-sm text-white">{company.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Kommentarer / Recensioner */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-white">Kommentarer</h3>

              {/* Kommentarsfält eller informationstext */}
              {isOwnProfile ? (
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-sm text-white text-center">
                    (Här lämnar jobbsökarna kommentarer om de vill samt betyg)
                  </p>
                </div>
              ) : (
                <div>
                  <button 
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 p-3 rounded-lg transition-colors"
                  >
                    <span className="text-sm font-medium text-white">Lämna en recension</span>
                    <ChevronDown 
                      className={`h-4 w-4 text-white transition-transform duration-300 ${
                        isFormOpen ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  <div className={`overflow-hidden transition-[max-height,margin] duration-300 ease-out ${
                    isFormOpen ? 'max-h-[600px] mt-3' : 'max-h-0 mt-0'
                  }`}>
                    <div className="bg-white/5 p-4 rounded-lg space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-2 block text-white">Betyg</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setNewRating(star)}
                              className="transition-colors"
                            >
                              <Star
                                className={`h-5 w-5 ${
                                  star <= newRating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-transparent text-white stroke-white stroke-[1.5]"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block text-white">Din kommentar</label>
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Dela dina erfarenheter av detta företag..."
                          className="min-h-[100px] bg-white/10 border-white/20 hover:border-white/50 text-white placeholder:text-white"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="anonymous"
                          checked={isAnonymous}
                          onChange={(e) => setIsAnonymous(e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="anonymous" className="text-sm text-white">
                          Publicera anonymt
                        </label>
                      </div>

                      <Button 
                        onClick={handleSubmitReview} 
                        disabled={submitting}
                        variant="glass"
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitting ? "Skickar..." : "Skicka kommentar"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista med kommentarer */}
              <div className="space-y-4 mt-6">
                {cachedReviews.length === 0 ? (
                  <p className="text-center text-white py-8">
                    Inga kommentarer än. Var först med att dela dina erfarenheter!
                  </p>
                ) : (
                  cachedReviews.map((review) => (
                    <div key={review.id} className="border border-white/10 rounded-lg p-4 space-y-2">
                      <div>
                        <p className="font-medium text-white">
                          {review.is_anonymous
                            ? "Anonym"
                            : `${review.profiles?.first_name || ""} ${
                                review.profiles?.last_name?.[0] || ""
                              }.`}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < (review.rating || 0)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-transparent text-white stroke-white stroke-[1.5]"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-white">
                            {new Date(review.created_at).toLocaleDateString("sv-SE")}
                          </span>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-white mt-2 break-all overflow-hidden">
                          <span className="text-white">Kommentar:</span> {review.comment}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContentNoFocus>
    </Dialog>
  );
}
