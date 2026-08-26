import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, dialogCloseButtonClassName, dialogCloseIconClassName } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, MapPin, Video, Building2, Loader2, X, Pencil, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { format, startOfDay, isToday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { normalizeMeetingLink, isSupportedMeetingLink } from '@/lib/meetingLink';
import { useOrgDefaultVideoLink } from '@/hooks/useOrgDefaultVideoLink';
import { formatSwedishTime, isSwedishTimeZone, getLocalTimeZoneCity } from '@/lib/localTime';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BookInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  onSuccess?: () => void;
  /** Render above z-[100] overlays (e.g. SwipeViewer) */
  elevated?: boolean;
}

const FALLBACK_MESSAGE = `Hej!

Tack för din ansökan. Vi skulle gärna vilja träffa dig på en intervju.

Vänliga hälsningar`;

function getVideoLinkLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('meet.google.com')) return 'Din Google Meet-länk';
  if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) return 'Din Teams-länk';
  if (lower.includes('zoom.us') || lower.includes('zoom.com')) return 'Din Zoom-länk';
  if (lower.includes('whereby.com')) return 'Din Whereby-länk';
  if (lower.includes('webex.com')) return 'Din Webex-länk';
  return 'Din videolänk';
}

export const BookInterviewDialog = ({
  open,
  onOpenChange,
  candidateName,
  candidateId,
  applicationId,
  jobId,
  jobTitle,
  onSuccess,
  elevated,
}: BookInterviewDialogProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const skipNextMessageResetRef = useRef(false);
  const prefilledInterviewIdRef = useRef<string | null>(null);

  
  // Get employer's settings from profile FIRST (before using in state initialization)
  const savedOfficeAddress = (profile as any)?.interview_office_address || profile?.address || '';
  const officeDefaultMessage = (profile as any)?.interview_default_message || FALLBACK_MESSAGE;
  const videoDefaultMessage = (profile as any)?.interview_video_default_message || FALLBACK_MESSAGE;
  const orgDefaultVideoLink = useOrgDefaultVideoLink();
  // Egen sparad länk vinner; annars ärvs organisationens standardlänk
  // (så en nyinbjuden kollega slipper leta upp den själv).
  const savedVideoLink =
    normalizeMeetingLink((profile as any)?.interview_video_link || '') || orgDefaultVideoLink;
  const officeInstructions = (profile as any)?.interview_office_instructions || '';
  const companyName = profile?.company_name || '';
  
  // Form state - use functions to reset to defaults based on open state
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [locationType, setLocationType] = useState<'video' | 'office'>('video');
  const [locationDetails, setLocationDetails] = useState('');
  const [editableAddress, setEditableAddress] = useState(savedOfficeAddress);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // State for editable video link
  const [editableVideoLink, setEditableVideoLink] = useState(savedVideoLink);
  const [videoLinkEditing, setVideoLinkEditing] = useState(false);
  const [saveVideoLinkAsDefault, setSaveVideoLinkAsDefault] = useState(false);

  const trimmedVideoLink = editableVideoLink.trim();
  const videoLinkIsValid = trimmedVideoLink
    ? isSupportedMeetingLink(normalizeMeetingLink(trimmedVideoLink))
    : false;
  const videoLinkDiffersFromDefault =
    !!trimmedVideoLink && normalizeMeetingLink(trimmedVideoLink) !== savedVideoLink;

  // Get the correct default message based on location type
  const getDefaultMessageForType = (type: 'video' | 'office') => {
    return type === 'video' ? videoDefaultMessage : officeDefaultMessage;
  };

  // Reset form immediately when dialog CLOSES to prevent stale state flash
  // This ensures next open starts with clean defaults
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to defaults immediately when closing
      setLocationType('video');
      setDate(undefined);
      setTime('10:00');
      setDuration('30');
      setLocationDetails('');
      setEditableAddress(savedOfficeAddress);
      setEditableVideoLink(savedVideoLink);
      setVideoLinkEditing(false);
      setSaveVideoLinkAsDefault(false);
      setMessage(videoDefaultMessage);
      setSubject('');
    }
    onOpenChange(newOpen);
  };

  // Finns redan en aktiv intervju för ansökan? Då är detta en ombokning,
  // inte ett nytt möte – annars skulle kandidaten få dubbla kallelser.
  const { data: existingInterview } = useQuery({
    queryKey: ['existing-interview', applicationId],
    enabled: open && !!applicationId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('id, scheduled_at, duration_minutes, location_type, location_details, subject, message')
        .eq('application_id', applicationId)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Ett möte som redan är över ska inte bokas om – då är det ett nytt möte.
      const end = new Date(data.scheduled_at).getTime() + (data.duration_minutes || 30) * 60_000;
      return end > Date.now() ? data : null;
    },
  });

  const isReschedule = !!existingInterview;

  // Set default values when dialog OPENS (transition false → true).
  // Får aldrig köra om på profil-refetch — då skulle en bakgrundsuppdatering
  // nollställa datum, platstyp, meddelande och rekryterarens inskrivna länk.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSubject(`Intervju för ${jobTitle}`);
      setDate(new Date());
      setLocationType('video');
      setMessage(videoDefaultMessage);
      // Sync editable fields from latest profile values
      setEditableAddress(savedOfficeAddress);
      setEditableVideoLink(savedVideoLink);
      setVideoLinkEditing(false);
      setSaveVideoLinkAsDefault(false);
    }
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Förifyll med den befintliga bokningen när det är en ombokning.
  // Får bara ske EN gång per öppning – annars skriver en bakgrundsrefetch
  // (t.ex. när fönstret får fokus igen) över rekryterarens pågående ändringar.
  useEffect(() => {
    if (!open) {
      prefilledInterviewIdRef.current = null;
      skipNextMessageResetRef.current = false;
      return;
    }
    if (!existingInterview) return;
    if (prefilledInterviewIdRef.current === existingInterview.id) return;
    prefilledInterviewIdRef.current = existingInterview.id;
    const scheduled = new Date(existingInterview.scheduled_at);
    if (!Number.isNaN(scheduled.getTime())) {
      setDate(scheduled);
      setTime(`${String(scheduled.getHours()).padStart(2, '0')}:${String(Math.floor(scheduled.getMinutes() / 15) * 15).padStart(2, '0')}`);
    }
    setDuration(String(existingInterview.duration_minutes || 30));
    const type = existingInterview.location_type === 'office' ? 'office' : 'video';
    setLocationType(type);
    if (type === 'video') {
      const link = normalizeMeetingLink(existingInterview.location_details || '');
      if (link) setEditableVideoLink(link);
    } else if (existingInterview.location_details) {
      setEditableAddress(existingInterview.location_details.split('\n\n')[0]);
    }
    if (existingInterview.subject) setSubject(existingInterview.subject);
    if (existingInterview.message) {
      skipNextMessageResetRef.current = true;
      setMessage(existingInterview.message);
    }
  }, [open, existingInterview]);



  // Update message when location type changes
  useEffect(() => {
    if (open) {
      // Vid ombokning behåller vi rekryterarens egna text – standardmallen
      // får aldrig skriva över den när platstypen förifylls.
      if (skipNextMessageResetRef.current) {
        skipNextMessageResetRef.current = false;
        return;
      }
      // Byt bara ut texten om den fortfarande är en oredigerad standardmall.
      setMessage((current) => {
        const untouched =
          current.trim() === '' ||
          current === videoDefaultMessage ||
          current === officeDefaultMessage ||
          current === FALLBACK_MESSAGE;
        return untouched ? getDefaultMessageForType(locationType) : current;
      });
    }
  }, [locationType]);


  // Update location details when type or address changes
  useEffect(() => {
    if (locationType === 'office') {
      // Combine address with instructions if both exist
      const details = officeInstructions 
        ? `${editableAddress}\n\n${officeInstructions}`
        : editableAddress;
      setLocationDetails(details);
    } else if (locationType === 'video') {
      const normalizedVideoLink = normalizeMeetingLink(editableVideoLink);
      // Use video link if available, otherwise show generic message
      setLocationDetails(normalizedVideoLink || 'Videointervju – länk skickas separat');
    }
  }, [locationType, editableAddress, officeInstructions, editableVideoLink]);

  const handleSubmit = async () => {
    if (!user || !date) {
      toast.error('Välj ett datum för intervjun');
      return;
    }
    
    if (locationType === 'video' && trimmedVideoLink && !videoLinkIsValid) {
      toast.error('Videolänken ser inte giltig ut', {
        description: 'Klistra in hela länken från Teams, Zoom, Google Meet, Webex eller Whereby.',
      });
      return;
    }

    if (locationType === 'office' && !editableAddress.trim()) {
      toast.error('Ange adressen för intervjun');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledAt = new Date(date);
      scheduledAt.setHours(hours, minutes, 0, 0);
      // Dialogen kan ha stått öppen förbi den valda tiden – boka aldrig bakåt.
      if (scheduledAt.getTime() <= Date.now()) {
        toast.error('Välj en tid som ligger framåt i tiden');
        setIsSubmitting(false);
        return;
      }
      const normalizedVideoLocationDetails =
        locationType === 'video'
          ? normalizeMeetingLink(editableVideoLink || locationDetails || '')
          : locationDetails || '';

      const interviewFields = {
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(duration),
        location_type: locationType,
        location_details: normalizedVideoLocationDetails || null,
        subject: subject || null,
        message: message || null,
      };

      // Ombokning uppdaterar samma möte – annars får kandidaten två
      // kalenderposter och två intervjuer i sina listor.
      const { data: interviewRow, error } = isReschedule && existingInterview
        ? await supabase
            .from('interviews')
            .update({ ...interviewFields, status: 'pending' })
            .eq('id', existingInterview.id)
            .eq('employer_id', user.id)
            .select('id')
            .single()
        : await supabase.from('interviews').insert({
            job_id: jobId,
            applicant_id: candidateId,
            application_id: applicationId,
            employer_id: user.id,
            ...interviewFields,
            status: 'pending',
          }).select('id').single();

      if (error) throw error;

      // Spara länken som standard om rekryteraren bad om det.
      if (locationType === 'video' && saveVideoLinkAsDefault && videoLinkIsValid && videoLinkDiffersFromDefault) {
        try {
          await supabase
            .from('profiles')
            .update({ interview_video_link: normalizeMeetingLink(trimmedVideoLink) })
            .eq('user_id', user.id);
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        } catch (linkErr) {
          console.error('Kunde inte spara standardlänk:', linkErr);
        }
      }

      let description = isReschedule ? 'Intervjun är ombokad.' : 'Intervjun är bokad.';

      // 1. Send the interview invitation email with .ics calendar attachment
      try {
        // Get candidate email from application
        const { data: appData } = await supabase
          .from('job_applications')
          .select('email, first_name')
          .eq('id', applicationId)
          .single();

        const candidateEmail = appData?.email;
        if (candidateEmail && interviewRow?.id) {
          await supabase.functions.invoke('send-interview-invitation', {
            body: {
              candidateEmail,
              candidateName,
              companyName: companyName || 'Företag',
              jobTitle,
              scheduledAt: scheduledAt.toISOString(),
              durationMinutes: parseInt(duration),
              locationType,
              locationDetails: normalizedVideoLocationDetails || undefined,
              message: message || undefined,
              employerEmail: user?.email || undefined,
              employerName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || undefined,
              interviewId: interviewRow.id,
            },
          });
        }

      } catch (emailErr) {
        console.error('Error sending interview email:', emailErr);
        // Non-blocking — interview is already created
      }

      // 2. Trigger outreach automations (chat, push, etc.)
      try {
        const { data: dispatchData, error: dispatchError } = await supabase.functions.invoke('outreach-dispatch', {
          body: {
            processPending: true,
            trigger: 'interview_scheduled',
            interviewId: interviewRow.id,
          },
        });
        if (dispatchError) throw dispatchError;
        const processedCount = Number((dispatchData as { processedCount?: number } | null)?.processedCount ?? 0);
        description = processedCount > 0
          ? `Intervjukallelse skickad med kalenderinbjudan + ${processedCount} automation${processedCount > 1 ? 'er' : ''}.`
          : 'Intervjukallelse med kalenderinbjudan skickad!';
      } catch (dispatchErr) {
        console.error('Error invoking outreach-dispatch:', dispatchErr);
        description = 'Intervjukallelse med kalenderinbjudan skickad!';
      }

      toast.success(
        isReschedule ? `Intervju ombokad för ${candidateName}` : `Intervju bokad för ${candidateName}`,
        { description, route: '/my-candidates' } as Parameters<typeof toast.success>[1],
      );

      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['existing-interview', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['candidate-activities'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating interview:', error);
      toast.error(isReschedule ? 'Kunde inte boka om intervjun' : 'Kunde inte boka intervjun');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate time options (every 15 min, full 24 hours)
  const allTimeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      allTimeOptions.push(timeStr);
    }
  }

  // Filter times if today is selected - only show future times
  const timeOptions = date && isToday(date) 
    ? allTimeOptions.filter(t => {
        const [hours, minutes] = t.split(':').map(Number);
        const now = new Date();
        const timeDate = new Date();
        timeDate.setHours(hours, minutes, 0, 0);
        return timeDate > now;
      })
    : allTimeOptions;

  // Reset time if current selection is no longer valid
  React.useEffect(() => {
    if (date && isToday(date) && !timeOptions.includes(time) && timeOptions.length > 0) {
      setTime(timeOptions[0]);
    }
  }, [date, timeOptions, time]);

  // Calculate end time based on start time and duration
  const getEndTime = (startTime: string, durationMinutes: string) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + parseInt(durationMinutes);
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const endTime = getEndTime(time, duration);

  // Tidsvalet tolkas i rekryterarens egen tidszon. Sitter man utomlands visas
  // motsvarande svensk tid automatiskt, så ingen bokar fel timme.
  const zoneNotice = (() => {
    if (!date || isSwedishTimeZone()) return null;
    const [h, m] = time.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + parseInt(duration) * 60_000);
    const swedishStart = formatSwedishTime(start);
    if (swedishStart === time) return null;
    return `${time}\u2013${endTime} i ${getLocalTimeZoneCity()} = ${swedishStart}\u2013${formatSwedishTime(end)} svensk tid`;
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContentNoFocus 
        hideClose
        elevated={elevated}
        className="parium-panel max-w-none w-[min(92vw,500px)] max-h-[85vh] bg-parium-gradient text-white border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden p-0 flex flex-col"
      >
        <DialogHeader className="sr-only">
          <DialogTitle className="sr-only">{isReschedule ? 'Boka om intervju' : 'Boka intervju'}</DialogTitle>
          <DialogDescription className="sr-only">Skicka en intervjukallelse till {candidateName}</DialogDescription>
        </DialogHeader>
        <AnimatedBackground showBubbles={false} />

        <div className="relative z-10 flex flex-col max-h-[85vh]">
          <div className="relative flex items-center justify-center p-4 border-b border-white/20 flex-shrink-0 bg-background/10">
            <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {isReschedule ? 'Boka om intervju' : 'Boka intervju'}
              </h2>
              <button
                onClick={() => handleOpenChange(false)}
                className={dialogCloseButtonClassName}
              >
                <X className={dialogCloseIconClassName} />
              </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <p className="text-white text-center text-sm leading-snug">
              {isReschedule
                ? `Ändra tid eller plats för intervjun med ${candidateName} – ${jobTitle}. Kandidaten får en ny kallelse och kalenderinbjudan.`
                : `Skicka en intervjukallelse till ${candidateName} för tjänsten ${jobTitle}`}
            </p>

          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-white">Datum</Label>
            <Popover modal>
              <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full h-[var(--control-height)] flex items-center justify-start text-left text-sm font-normal bg-white/10 border border-white/20 rounded-md px-3 py-2 transition-colors hover:border-white/30",
                      date ? "text-white" : "text-white/60"
                    )}
                  >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (() => {
                    const formatted = format(date, 'EEEE d MMMM yyyy', { locale: sv });
                    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
                  })() : 'Välj datum'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto z-[120]" align="center" side="bottom" sideOffset={4} avoidCollisions={false}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < startOfDay(new Date())}
                  initialFocus
                  className="pointer-events-auto touch-manipulation"
                  classNames={{
                    day_today: "" // Remove today highlight
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time and duration */}
          <div className="grid grid-cols-[minmax(0,1fr)_7.25rem] sm:grid-cols-[minmax(0,1fr)_8rem] gap-3 items-end">
            <div className="space-y-2">
              <Label className="text-white">Tid</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white [&>svg]:text-white">
                  <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left truncate text-sm">{time} →{endTime}</span>
                </SelectTrigger>
                <SelectContent 
                  side="bottom" 
                  align="start" 
                  sideOffset={4} 
                  avoidCollisions={false}
                  className="max-h-[200px] overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t} className="py-1.5 text-sm">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full shrink-0">
              <Label className="text-white">Längd</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="w-full min-w-0 bg-white/10 border-white/20 text-white [&>svg]:text-white text-sm whitespace-nowrap pr-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {zoneNotice && (
            <p className="-mt-1 text-xs text-white/80 break-words leading-snug">
              {zoneNotice}
            </p>
          )}

          {/* Location type */}
          <div className="space-y-2">
            <Label className="text-white">Plats</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cn(
                  "h-11 inline-flex items-center justify-center gap-2 px-3 rounded-md border text-sm transition-colors duration-300 focus:outline-none focus:ring-0",
                  locationType === 'video'
                    ? "bg-white/20 border-white/40 text-white"
                    : "bg-white/10 border-white/20 text-white/80 hover:text-white hover:border-white/30"
                )}
                onClick={() => setLocationType('video')}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
              >
                <Video className="h-4 w-4" />
                <span>Videomöte</span>
              </button>
              <button
                type="button"
                className={cn(
                  "h-11 inline-flex items-center justify-center gap-2 px-3 rounded-md border text-sm transition-colors duration-300 focus:outline-none focus:ring-0",
                  locationType === 'office'
                    ? "bg-white/20 border-white/40 text-white"
                    : "bg-white/10 border-white/20 text-white/80 hover:text-white hover:border-white/30"
                )}
                onClick={() => setLocationType('office')}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
              >
                <Building2 className="h-4 w-4" />
                <span>På plats</span>
              </button>
            </div>
          </div>

          {/* Video link input */}
          {locationType === 'video' && (
            <div className="space-y-2">
              <Label className="text-white">Videolänk</Label>

              {trimmedVideoLink && !videoLinkEditing ? (
                <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2.5 flex items-center gap-2.5">
                  {videoLinkIsValid ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="min-w-0 flex-1 cursor-help text-left">
                          <p className="text-white text-sm truncate">{getVideoLinkLabel(trimmedVideoLink)}</p>
                          <p className="text-white/70 text-xs line-clamp-2 break-all">
                            {trimmedVideoLink.replace(/^https?:\/\//, '')}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[min(22rem,80vw)] break-all">
                        {trimmedVideoLink}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <button
                    type="button"
                    onClick={() => setVideoLinkEditing(true)}
                    onMouseDown={(e) => e.currentTarget.blur()}
                    onMouseUp={(e) => e.currentTarget.blur()}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-0"
                  >
                    <Pencil className="h-3 w-3" />
                    Ändra
                  </button>
                </div>
              ) : (
                <Input
                  value={editableVideoLink}
                  onChange={(e) => setEditableVideoLink(e.target.value)}
                  onBlur={() => {
                    const normalized = normalizeMeetingLink(editableVideoLink);
                    setEditableVideoLink(normalized);
                    if (normalized) setVideoLinkEditing(false);
                  }}
                  autoFocus={videoLinkEditing}
                  inputMode="url"
                  placeholder="Klistra in din möteslänk"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              )}

              {trimmedVideoLink && !videoLinkIsValid && (
                <p className="text-amber-400 text-xs">
                  Länken känns inte igen som Teams, Zoom, Google Meet, Webex eller Whereby. Kontrollera att du klistrat in hela länken.
                </p>
              )}

              {!trimmedVideoLink && (
                <p className="text-white text-xs">
                  Ingen länk angiven – kandidaten får kallelsen med texten “Videointervju – länk skickas separat”.
                </p>
              )}

              {videoLinkIsValid && videoLinkDiffersFromDefault && (
                <button
                  type="button"
                  onClick={() => setSaveVideoLinkAsDefault((v) => !v)}
                  onMouseDown={(e) => e.currentTarget.blur()}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  className="flex items-center gap-2 text-xs text-white transition-colors focus:outline-none focus:ring-0"
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                      saveVideoLinkAsDefault ? "bg-white/30 border-white/50" : "border-white/30 bg-white/10"
                    )}
                  >
                    {saveVideoLinkAsDefault && <Check className="h-3 w-3 text-white" />}
                  </span>
                  Spara som min standardlänk
                </button>
              )}
            </div>
          )}


          {/* Location details - Address and Instructions */}
          {locationType === 'office' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-white">Adress</Label>
                <Input
                  value={editableAddress}
                  onChange={(e) => setEditableAddress(e.target.value)}
                  placeholder="Ange adress för mötet"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              {officeInstructions && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <Label className="text-white/80 text-xs uppercase tracking-wide mb-1.5 block">Instruktioner till kandidaten</Label>
                  <p className="text-white text-sm whitespace-pre-wrap">{officeInstructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label className="text-white">Ämnesrad</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ämne för intervjukallelsen"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-white">Meddelande till kandidaten</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ett personligt meddelande..."
              rows={4}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => handleSubmit()} 
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                disabled={isSubmitting || !date}
                className={`flex-1 min-h-[44px] rounded-full transition-colors duration-150 active:scale-95 focus:outline-none focus:ring-0 ${
                  !isSubmitting && date ? 'border border-white/30' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Skickar...
                  </>
                ) : (
                  isReschedule ? 'Skicka ny tid' : 'Skicka intervjukallelse'
                )}
              </Button>
              <Button 
                variant="glass" 
                onClick={() => handleOpenChange(false)}
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                className="min-h-[44px] rounded-full transition-colors duration-300 focus:outline-none focus:ring-0"
              >
                Avbryt
              </Button>
            </div>
          </div>
        </div>

      </DialogContentNoFocus>
    </Dialog>
  );
};
