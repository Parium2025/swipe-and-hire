import { useState } from 'react';
import { format, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Building2,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Check,
  X,
  Loader2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import { toast } from 'sonner';

interface CandidateInterviewCardProps {
  interview: {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    location_type: 'video' | 'office' | 'phone';
    location_details: string | null;
    subject: string | null;
    message: string | null;
    status: string;
    job_postings?: {
      title: string;
      employer_id: string;
    } | null;
    profiles?: {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };
}

export const CandidateInterviewCard = ({ interview }: CandidateInterviewCardProps) => {
  const { respondToInterview } = useCandidateInterviews();
  const [isResponding, setIsResponding] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const scheduledDate = new Date(interview.scheduled_at);
  const now = new Date();
  const minutesUntil = differenceInMinutes(scheduledDate, now);
  const isLive = minutesUntil <= 15 && minutesUntil >= -interview.duration_minutes;
  const isPending = interview.status === 'pending';
  const isConfirmed = interview.status === 'confirmed';

  // Format date nicely
  const getDateLabel = () => {
    if (isToday(scheduledDate)) return 'Idag';
    if (isTomorrow(scheduledDate)) return 'Imorgon';
    return format(scheduledDate, 'EEEE d MMMM', { locale: sv });
  };

  // Get company/employer name
  const getEmployerName = () => {
    if (interview.profiles?.company_name) return interview.profiles.company_name;
    if (interview.profiles?.first_name) {
      return `${interview.profiles.first_name} ${interview.profiles.last_name || ''}`.trim();
    }
    return 'Arbetsgivare';
  };

  // Handle video link click
  const handleJoinVideo = () => {
    if (!interview.location_details) {
      toast.error('Ingen videolänk tillgänglig');
      return;
    }

    // Extract URL from location_details (might have extra text)
    let videoUrl = interview.location_details;
    
    // Try to extract URL if it's embedded in text
    const urlMatch = videoUrl.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      videoUrl = urlMatch[1];
    }

    // Open in new tab
    window.open(videoUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle accept/decline
  const handleRespond = async (accept: boolean) => {
    setIsResponding(true);
    try {
      await respondToInterview.mutateAsync({ interviewId: interview.id, accept });
      toast.success(accept ? 'Du har accepterat intervjun' : 'Du har avböjt intervjun');
    } catch (error) {
      toast.error('Något gick fel');
    } finally {
      setIsResponding(false);
    }
  };

  // Check if video link is a valid URL
  const hasVideoLink = interview.location_type === 'video' && 
    interview.location_details && 
    (interview.location_details.includes('http') || 
     interview.location_details.includes('teams') ||
     interview.location_details.includes('zoom') ||
     interview.location_details.includes('meet'));

  return (
    <Card className={cn(
      "border transition-all duration-300",
      isLive 
        ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 ring-1 ring-emerald-500/30" 
        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header with date and status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Live indicator */}
            {isLive && (
              <Badge className="bg-emerald-500 text-white border-0 mb-2 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full mr-2" />
                Pågår nu
              </Badge>
            )}

            {/* Job title */}
            <h3 className="text-lg font-semibold text-white truncate">
              {interview.subject || interview.job_postings?.title || 'Intervju'}
            </h3>

            {/* Company */}
            <p className="text-white/80 text-sm mt-0.5">
              {getEmployerName()}
            </p>
          </div>

          {/* Status badge */}
          {isPending && (
            <Badge variant="glass" className="bg-amber-500/20 text-amber-300 border-amber-500/30 shrink-0">
              Väntar på svar
            </Badge>
          )}
          {isConfirmed && !isLive && (
            <Badge variant="glass" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shrink-0">
              <Check className="w-3 h-3 mr-1" />
              Bekräftad
            </Badge>
          )}
        </div>

        {/* Date and time */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-white">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-white/70" />
            <span className="font-medium">{getDateLabel()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-white/70" />
            <span>
              {format(scheduledDate, 'HH:mm', { locale: sv })} - {format(
                new Date(scheduledDate.getTime() + interview.duration_minutes * 60000),
                'HH:mm',
                { locale: sv }
              )}
            </span>
          </div>
          <Badge variant="glass" className="text-xs">
            {interview.duration_minutes} min
          </Badge>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
          {interview.location_type === 'video' ? (
            <Video className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          ) : (
            <Building2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">
              {interview.location_type === 'video' ? 'Videomöte' : 'På plats'}
            </p>
            {interview.location_details && (
              <p className="text-white/70 text-sm mt-0.5 break-words whitespace-pre-wrap">
                {interview.location_type === 'video' && hasVideoLink
                  ? 'Länk tillgänglig - klicka för att ansluta'
                  : interview.location_details}
              </p>
            )}
          </div>
        </div>

        {/* Message toggle */}
        {interview.message && (
          <button
            onClick={() => setShowMessage(!showMessage)}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-full"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Meddelande från arbetsgivaren</span>
            {showMessage ? (
              <ChevronUp className="w-4 h-4 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-auto" />
            )}
          </button>
        )}

        {/* Message content */}
        {showMessage && interview.message && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-white/90 text-sm whitespace-pre-wrap">
              {interview.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {/* Pending: Accept/Decline buttons */}
          {isPending && (
            <>
              <Button
                onClick={() => handleRespond(true)}
                disabled={isResponding}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
              >
                {isResponding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Acceptera
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleRespond(false)}
                disabled={isResponding}
                variant="ghost"
                className="flex-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-white/10"
              >
                <X className="w-4 h-4 mr-2" />
                Avböj
              </Button>
            </>
          )}

          {/* Confirmed: Join button for video */}
          {isConfirmed && interview.location_type === 'video' && hasVideoLink && (
            <Button
              onClick={handleJoinVideo}
              className={cn(
                "flex-1",
                isLive 
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse" 
                  : "bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/30"
              )}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {isLive ? 'Anslut nu' : 'Öppna möteslänk'}
            </Button>
          )}

          {/* Confirmed office: Show address */}
          {isConfirmed && interview.location_type === 'office' && interview.location_details && (
            <Button
              onClick={() => {
                const query = encodeURIComponent(interview.location_details || '');
                window.open(`https://maps.google.com?q=${query}`, '_blank');
              }}
              variant="ghost"
              className="flex-1 text-white hover:bg-white/10 border border-white/10"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Visa vägbeskrivning
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CandidateInterviewCard;
