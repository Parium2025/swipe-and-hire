import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  MessageSquare,
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [company, setCompany] = React.useState<CompanyProfile | null>(null);
  const [reviews, setReviews] = React.useState<CompanyReview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newComment, setNewComment] = React.useState("");
  const [newRating, setNewRating] = React.useState(5);
  const [submitting, setSubmitting] = React.useState(false);
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && companyId) {
      fetchCompanyData();
      fetchReviews();
      getCurrentUser();
    }
  }, [open, companyId]);

  // Real-time lyssning för företagsprofil
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
          setCompany(payload.new as CompanyProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [open, companyId]);

  // Real-time lyssning för recensioner
  React.useEffect(() => {
    if (!open || !companyId) return;

    const reviewsChannel = supabase
      .channel(`reviews-dialog-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          console.log('New review added in dialog');
          fetchReviews();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          console.log('Review updated in dialog');
          fetchReviews();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          console.log('Review deleted in dialog');
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewsChannel);
    };
  }, [open, companyId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchCompanyData = async () => {
    try {
      console.log("Fetching company data for companyId:", companyId);
      const { data, error } = await supabase
        .from("profiles")
        .select("company_name, company_logo_url, company_description, website, industry, employee_count, address")
        .eq("user_id", companyId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching company data:", error);
        throw error;
      }
      
      console.log("Fetched company data:", data);
      setCompany(data);
    } catch (error) {
      console.error("Error fetching company:", error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta företagsinformation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("company_reviews")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately for non-anonymous reviews
      if (data && data.length > 0) {
        const userIds = data
          .filter(r => !r.is_anonymous)
          .map(r => r.user_id);
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", userIds);

          const reviewsWithProfiles = data.map(review => ({
            ...review,
            profiles: profiles?.find(p => p.user_id === review.user_id)
          }));

          setReviews(reviewsWithProfiles as CompanyReview[]);
        } else {
          setReviews(data as CompanyReview[]);
        }
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  const handleSubmitReview = async () => {
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

      if (error) throw error;

      toast({
        title: "Kommentar skickad",
        description: "Din kommentar har publicerats",
      });

      setNewComment("");
      setNewRating(5);
      setIsAnonymous(false);
      fetchReviews();
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
        <DialogContent className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-[hsl(215,100%,12%)] via-[hsl(215,90%,18%)] to-[hsl(215,100%,12%)] border-white/20">
          <div className="flex items-center justify-center p-4 md:p-6">
            <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!company) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-[hsl(215,100%,12%)] via-[hsl(215,90%,18%)] to-[hsl(215,100%,12%)] border-white/20">
          <div className="flex flex-col items-center justify-center p-4 md:p-6 text-white">
            <Building2 className="h-12 w-12 md:h-14 md:w-14 mb-3 text-white/50" />
            <p className="text-sm md:text-base font-medium mb-1.5">Företagsinformation saknas</p>
            <p className="text-xs md:text-sm text-white/70 text-center">
              Det finns ingen företagsprofil tillgänglig för detta konto.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "0";

  const isOwnProfile = currentUserId === companyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-gradient-to-br from-[hsl(215,100%,12%)] via-[hsl(215,90%,18%)] to-[hsl(215,100%,12%)] border-white/20">
        <ScrollArea className="max-h-[90vh] [&>div>div]:!overflow-y-scroll [&>div>div]:scrollbar-hide">
          <div className="p-3 md:p-4 text-white">
            <DialogHeader className="mb-3 md:mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 md:h-14 md:w-14">
                  <AvatarImage src={company.company_logo_url} alt={company.company_name} />
                  <AvatarFallback>
                    <Building2 className="h-5 w-5 md:h-6 md:w-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-base md:text-xl text-white">{company.company_name}</DialogTitle>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Star className="h-3 w-3 md:h-4 md:w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs md:text-sm text-white">
                      {averageRating} ({reviews.length} {reviews.length === 1 ? 'recension' : 'recensioner'})
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Översikt */}
            <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
              <h3 className="font-semibold text-sm md:text-base text-white">Översikt</h3>
              <p className="text-xs md:text-sm text-white/90">
                {company.company_description || "Ingen beskrivning tillgänglig."}
              </p>
            </div>

            <Separator className="my-3 md:my-4" />

            {/* Företagsinformation */}
            <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
              <h3 className="font-semibold text-sm md:text-base text-white">Företagsinformation</h3>
              
              <div className="grid gap-2 md:gap-2.5">
                {company.website && (
                  <div className="flex items-center gap-2 md:gap-2.5">
                    <Globe className="h-4 w-4 md:h-5 md:w-5 text-white flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-white">Webbplats</p>
                      <a 
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs md:text-sm text-white/90 hover:underline truncate block"
                      >
                        {company.website}
                      </a>
                    </div>
                  </div>
                )}

                {company.industry && (
                  <div className="flex items-center gap-2 md:gap-2.5">
                    <Briefcase className="h-4 w-4 md:h-5 md:w-5 text-white flex-shrink-0" />
                    <div>
                      <p className="text-xs md:text-sm font-medium text-white">Bransch</p>
                      <p className="text-xs md:text-sm text-white/90">{company.industry}</p>
                    </div>
                  </div>
                )}

                {company.employee_count && (
                  <div className="flex items-center gap-2 md:gap-2.5">
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-white flex-shrink-0" />
                    <div>
                      <p className="text-xs md:text-sm font-medium text-white">Företagsstorlek</p>
                      <p className="text-xs md:text-sm text-white/90">{company.employee_count} anställda</p>
                    </div>
                  </div>
                )}

                {company.address && (
                  <div className="flex items-center gap-2 md:gap-2.5">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-white flex-shrink-0" />
                    <div>
                      <p className="text-xs md:text-sm font-medium text-white">Huvudkontor</p>
                      <p className="text-xs md:text-sm text-white/90">{company.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-3 md:my-4" />

            {/* Kommentarer / Recensioner */}
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-1.5 md:gap-2">
                <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
                <h3 className="font-semibold text-sm md:text-base">Kommentarer</h3>
              </div>

              {/* Kommentarsfält eller informationstext */}
              {isOwnProfile ? (
                <div className="bg-white/5 p-2 md:p-2.5 rounded-lg">
                  <p className="text-[10px] md:text-xs text-white/70 text-center">
                    (Här lämnar jobbsökarna kommentarer om de vill samt betyg)
                  </p>
                </div>
              ) : (
                <div className="bg-white/5 p-2.5 md:p-3 rounded-lg space-y-2 md:space-y-2.5">
                  <div>
                    <label className="text-xs md:text-sm font-medium mb-1.5 block text-white">Betyg</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="transition-colors touch-manipulation"
                        >
                          <Star
                            className={`h-5 w-5 md:h-6 md:w-6 ${
                              star <= newRating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs md:text-sm font-medium mb-1.5 block text-white">Din kommentar</label>
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Dela dina erfarenheter av detta företag..."
                      className="min-h-[80px] md:min-h-[100px] text-xs md:text-sm touch-manipulation"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 md:gap-2">
                    <input
                      type="checkbox"
                      id="anonymous"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded h-4 w-4 touch-manipulation"
                    />
                    <label htmlFor="anonymous" className="text-xs md:text-sm text-white">
                      Publicera anonymt
                    </label>
                  </div>

                  <Button 
                    onClick={handleSubmitReview} 
                    disabled={submitting}
                    className="w-full h-11 md:h-10 text-xs md:text-sm touch-manipulation"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {submitting ? "Skickar..." : "Skicka kommentar"}
                  </Button>
                </div>
              )}

              {/* Lista med kommentarer */}
              <div className="space-y-2 md:space-y-3 mt-3 md:mt-4">
                {reviews.length === 0 ? (
                  <p className="text-center text-white/70 py-4 md:py-6 text-xs md:text-sm">
                    Inga kommentarer än. Var först med att dela dina erfarenheter!
                  </p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="border border-white/10 rounded-lg p-2.5 md:p-3 space-y-1.5 md:space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 md:gap-2.5">
                          <Avatar className="h-8 w-8 md:h-9 md:w-9">
                            <AvatarFallback className="text-xs md:text-sm">
                              {review.is_anonymous
                                ? "A"
                                : review.profiles?.first_name?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-xs md:text-sm text-white">
                              {review.is_anonymous
                                ? "Anonym"
                                : `${review.profiles?.first_name || ""} ${
                                    review.profiles?.last_name?.[0] || ""
                                  }.`}
                            </p>
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 md:h-3.5 md:w-3.5 ${
                                      i < (review.rating || 0)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] md:text-xs text-white/60">
                                {new Date(review.created_at).toLocaleDateString("sv-SE")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs md:text-sm text-white/80 mt-1.5">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
