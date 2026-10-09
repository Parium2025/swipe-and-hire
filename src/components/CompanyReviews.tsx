import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReviewThread } from '@/components/ReviewThread';
import { ReviewReplyActions } from '@/components/ReviewReplyActions';
import { ReportContentButton } from '@/components/ReportContentButton';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  ExternalLink,
  Reply
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { resolveCompanyLogoUrl } from '@/lib/companyLogoUrl';
import { getCompanyInitials } from '@/lib/companyInitials';
import { useCompanyReviewsCache } from '@/hooks/useCompanyReviewsCache';
import { getOrganizationReviewOwnerId } from '@/lib/organizationMembers';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';

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
  company_social_media_links?: SocialMediaLink[];
}

interface CompanyReview {
  id: string;
  company_id: string;
  user_id: string;
  rating: number;
  comment: string;
  is_anonymous: boolean;
  created_at: string;
  employer_reply?: string | null;
  employer_reply_at?: string | null;
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

const CompanyReviews = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { isAdmin: isOrgAdmin } = useIsOrgAdmin();
  const queryClient = useQueryClient();
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);

  const startReply = (review: CompanyReview) => {
    setEditingReplyId(review.id);
    setReplyDraft(review.employer_reply ?? '');
  };

  const saveReply = async (reviewId: string, reply: string) => {
    setSavingReplyId(reviewId);
    try {
      const { error } = await supabase.rpc('reply_to_company_review', {
        _review_id: reviewId,
        _reply: reply,
      });
      if (error) throw error;
      setEditingReplyId(null);
      setReplyDraft('');
      queryClient.invalidateQueries({ queryKey: ['company-reviews-cached', reviewOwnerId] });
      toast({
        title: reply.trim() ? "Svar skickat" : "Svar borttaget",
        description: reply.trim() ? "Ditt svar visas nu under recensionen." : "Svaret har tagits bort.",
      });
      return true;
    } catch (e) {
      console.error('Error saving review reply:', e);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera svaret. Försök igen.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSavingReplyId(null);
    }
  };

  const { data: reviewOwnerId, isLoading: ownerLoading } = useQuery({
    queryKey: ['organization-review-owner', user?.id, profile?.organization_id],
    queryFn: () => getOrganizationReviewOwnerId(user?.id ?? '', profile?.organization_id),
    enabled: !!user?.id && !!profile,
    staleTime: 5 * 60 * 1000,
  });

  // Read the organization owner's shared company fields rather than a recruiter's invite-time copy.
  const { data: company, isLoading: companyLoading, isError: companyError, refetch: refetchCompany } = useQuery({
    queryKey: ['company-public-profile', reviewOwnerId],
    queryFn: async () => {
      if (!reviewOwnerId) return null;
      const { data, error } = await supabase
        .rpc('get_employer_public_profile', { target_user_id: reviewOwnerId })
        .maybeSingle();
      if (error) throw error;
      return data ? {
        ...data,
        id: data.user_id,
        company_social_media_links: Array.isArray(data.company_social_media_links)
          ? data.company_social_media_links as unknown as SocialMediaLink[] : [],
      } as CompanyProfile : null;
    },
    enabled: !!reviewOwnerId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!reviewOwnerId) return;
    const channel = supabase.channel(`reviews-branding-${reviewOwnerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_change_signals', filter: `profile_user_id=eq.${reviewOwnerId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['company-public-profile', reviewOwnerId] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reviewOwnerId, queryClient]);

  // Delad cache + realtime-synk (localStorage-instant load, bakgrundssynk)
  const {
    reviews: cachedReviews,
    avgRating,
    reviewCount,
    isLoading: reviewsLoading,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useCompanyReviewsCache(reviewOwnerId ?? null);
  const reviews = (cachedReviews ?? []) as unknown as CompanyReview[];
  // Endast bolagets admin svarar (eller ägaren själv utan organisation); rekryterare och jobbsökare ser bara svaren.
  const canReply = profile?.organization_id
    ? isOrgAdmin
    : !!user?.id && !!reviewOwnerId && reviewOwnerId === user.id;

  const loading = companyLoading || ownerLoading || reviewsLoading;

  // Snitt + antal är serverräknade över ALLA recensioner, inte bara hämtade sidor.
  const averageRating = reviewCount > 0 ? (avgRating ?? 0).toFixed(1) : "0";

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-white/40 stroke-white/40 stroke-[1.5]'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8 responsive-container animate-pulse [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="h-6 w-40 bg-white/10 rounded mx-auto" />
          <div className="h-3 w-64 bg-white/10 rounded mx-auto" />
        </div>

        {/* Main card */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-6">
          {/* Logo + name */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-48 bg-white/10 rounded" />
              <div className="h-3 w-32 bg-white/10 rounded" />
            </div>
          </div>

          {/* Översikt */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-3 w-full bg-white/10 rounded" />
            <div className="h-3 w-5/6 bg-white/10 rounded" />
          </div>

          <div className="h-px w-full bg-white/10" />

          {/* Företagsinformation */}
          <div className="space-y-3">
            <div className="h-4 w-40 bg-white/10 rounded" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="h-4 w-4 rounded bg-white/10 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-24 bg-white/10 rounded" />
                  <div className="h-3 w-40 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>

          <div className="h-px w-full bg-white/10" />

          {/* Kommentarer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-white/10" />
              <div className="h-4 w-28 bg-white/10 rounded" />
            </div>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="border border-white/10 rounded-lg p-3 space-y-2">
                <div className="h-3 w-24 bg-white/10 rounded" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-20 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
                <div className="h-3 w-full bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
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
            {companyError ? 'Det gick inte att hämta företagsinformationen.' : 'Företagsinformation saknas.'}
          </p>
          {companyError && <Button onClick={() => void refetchCompany()} className="mt-4">Försök igen</Button>}
        </div>
      </div>
    );
  }

  return (
     <div className="space-y-8 responsive-container [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-1">Recensioner</h1>
        <p className="text-sm text-white">
          Se hur ditt företag upplevs av jobbsökare.
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
        {/* Header med Logo och Namn */}
        <div className="mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage
                src={resolveCompanyLogoUrl(company.company_logo_url) || ''}
                alt={company.company_name}
                loading="eager"
                decoding="async"
              />
              <AvatarFallback fallbackType="company" className="bg-pure-white/20 text-pure-white text-lg font-bold" delayMs={150}>
                {getCompanyInitials(company.company_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-pure-white leading-tight tracking-normal [overflow-wrap:anywhere]">{company.company_name}</h2>
              <div className="flex items-start gap-2 mt-1.5 text-sm text-pure-white tracking-normal">
                <Star aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5 fill-rating-star text-rating-star" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {averageRating} ({reviewCount} {reviewCount === 1 ? 'recension' : 'recensioner'})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Översikt */}
        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-lg text-white">Översikt</h3>
          <p className="text-white leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
            {company.company_description || "Ingen beskrivning tillgänglig."}
          </p>
        </div>

        <Separator className="my-6 bg-white/10" />

        {/* Företagsinformation */}
        <div className="space-y-4 mb-6">
          <h3 className="font-semibold text-lg text-white">Företagsinformation</h3>

          <div className="grid gap-2.5">
            {company.website && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Globe className="h-[18px] w-[18px] text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white uppercase tracking-wide">Webbplats</p>
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:underline truncate block"
                  >
                    {company.website}
                  </a>
                </div>
              </div>
            )}

            {([
              [company.industry, Briefcase, 'Bransch'],
              [company.employee_count, Users, 'Företagsstorlek'],
              [company.address, MapPin, 'Huvudkontor'],
            ] as const).map(([value, Icon, label]) => value ? (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-[18px] w-[18px] text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-white">{value}</p>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Sociala medier */}
        {company.company_social_media_links && company.company_social_media_links.length > 0 && (
          <>
            <Separator className="my-6 bg-white/10" />
            
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-base text-white">Sociala medier</h3>
              
              <div className="grid gap-2.5">
                {company.company_social_media_links.map((link, index) => {
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
                          title={link.url}
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
              (Här kan jobbsökare lämna kommentarer och betyg.)
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
                    <ReportContentButton target="review" reviewId={review.id} />
                  </div>
                  {review.comment && (
                    <div className="text-sm text-white mt-2">
                      <span className="text-white">Kommentar: </span>
                      <TruncatedText
                        text={review.comment}
                        className="text-white inline-block align-bottom max-w-full"
                        tooltipSide="top"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      />
                    </div>
                  )}

                  {/* Företagets svar */}
                  {review.employer_reply && editingReplyId !== review.id && (
                    <div className="mt-3 ml-3 border-l-2 border-white/20 pl-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-pure-white">Svar från företaget</p>
                        {canReply && <ReviewReplyActions onEdit={() => startReply(review)} onDelete={() => saveReply(review.id, '')} removesThread disabled={savingReplyId === review.id} />}
                      </div>
                      <p className="text-sm text-white whitespace-pre-line [overflow-wrap:anywhere]">
                        {review.employer_reply}
                      </p>
                      {review.employer_reply_at && (
                        <p className="text-xs text-pure-white">
                          {new Date(review.employer_reply_at).toLocaleDateString("sv-SE")}
                        </p>
                      )}
                    </div>
                  )}
                  {review.employer_reply && editingReplyId !== review.id && (
                    <ReviewThread reviewId={review.id} canPost={canReply} viewer="company" />
                  )}

                  {/* Svara / redigera svar */}
                  {canReply && editingReplyId === review.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Skriv ett svar till jobbsökaren…"
                        maxLength={1000}
                        autoResize={false}
                        className="h-[100px] min-h-[100px] max-h-[100px] overflow-y-auto bg-white/5 border-white/10 text-white text-sm resize-none placeholder:text-white/40"
                      />
                      <div className="flex justify-end">
                        <span className="text-[11px] tabular-nums text-white">
                          {replyDraft.length.toLocaleString('sv-SE')} / 1 000 tecken
                        </span>
                      </div>
                      <div className="mx-auto grid w-full max-w-[280px] grid-cols-2 items-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant="glass"
                          size="sm"
                          onClick={() => { setEditingReplyId(null); setReplyDraft(''); }}
                          disabled={savingReplyId === review.id}
                          className="h-11 w-full min-w-0 rounded-full px-3"
                        >
                          Avbryt
                        </Button>
                        <Button
                          type="button"
                          variant="glassGreen"
                          size="sm"
                          onClick={() => saveReply(review.id, replyDraft)}
                          disabled={savingReplyId === review.id || !replyDraft.trim()}
                          className="h-11 w-full min-w-0 rounded-full px-3"
                        >
                          {savingReplyId === review.id && <Loader2 className="h-4 w-4 animate-spin" />}
                          Skicka svar
                        </Button>
                      </div>
                    </div>
                  ) : canReply && !review.employer_reply && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => startReply(review)}
                        className="inline-flex items-center gap-1.5 text-sm text-white hover:underline"
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Svara
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Visa fler — hämtar nästa sida (50 åt gången) vid behov */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => loadMore()}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoadingMore ? 'Hämtar fler…' : `Visa fler recensioner (${reviews.length} av ${reviewCount})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyReviews;
