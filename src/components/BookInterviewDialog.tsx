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
import { existingInterviewQueryKey, fetchExistingInterview } from '@/lib/existingInterviewQuery';

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

const LOCATION_TYPE_STORAGE_PREFIX = 'parium:interview-location-type:';

function readRememberedLocationType(applicationId: string): 'video' | 'office' {
  try {
    const stored = localStorage.getItem(`${LOCATION_TYPE_STORAGE_PREFIX}${applicationId}`);
    return stored === 'office' ? 'office' : 'video';
  } catch {
    return 'video';
  }
}

function rememberLocationType(applicationId: string, type: 'video' | 'office') {
  try {
    localStorage.setItem(`${LOCATION_TYPE_STORAGE_PREFIX}${applicationId}`, type);
  } catch {
    /* privat läge – förvalet faller tillbaka på video */
  }
}

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
  const invitationSummaryRef = useRef<HTMLParagraphElement | null>(null);
  const [invitationSummaryTruncated, setInvitationSummaryTruncated] = useState(false);
  const [summaryTooltipOpen, setSummaryTooltipOpen] = useState(false);




  
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
  // Platstypen är förladdad från senaste kallelsen för just den här ansökan,
  // så fliken står rätt direkt när dialogen öppnas i stället för att hoppa
  // när den befintliga intervjun hämtas.
  const [locationType, setLocationType] = useState<'video' | 'office'>(() =>
    readRememberedLocationType(applicationId),
  );
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
      const remembered = readRememberedLocationType(applicationId);
      setLocationType(remembered);
      setDate(undefined);
      setTime('10:00');
      setDuration('30');
      setLocationDetails('');
      setEditableAddress(savedOfficeAddress);
      setEditableVideoLink(savedVideoLink);
      setVideoLinkEditing(false);
      setSaveVideoLinkAsDefault(false);
      setMessage(remembered === 'office' ? officeDefaultMessage : videoDefaultMessage);
      setSubject('');
    }
    onOpenChange(newOpen);
  };

  // Finns redan en aktiv intervju för ansökan? Då är detta en ombokning,
  // inte ett nytt möte – annars skulle kandidaten få dubbla kallelser.
  // Hämtaren delas med förvärmningen (se existingInterviewQuery.ts) så att
  // svaret redan ligger i cachen när dialogen öppnas.
  const { data: existingInterview } = useQuery({
    queryKey: existingInterviewQueryKey(applicationId),
    enabled: open && !!applicationId,
    staleTime: 30_000,
    queryFn: () => fetchExistingInterview(applicationId),
  });

  const isReschedule = !!existingInterview;
  // Endast den rekryterare som bokade mötet får ändra eller boka om det.
  // En kollega ser mötet men ska aldrig kunna röra någon annans kalender.
  const lockedByColleague = !!existingInterview && existingInterview.employer_id !== user?.id;

  useEffect(() => {
    if (!open) {
      setInvitationSummaryTruncated(false);
      return;
    }

    const element = invitationSummaryRef.current;
    if (!element) return;
    const measure = () => {
      setInvitationSummaryTruncated(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, candidateName, jobTitle, isReschedule]);

  // Set default values when dialog OPENS (transition false → true).
  // Får aldrig köra om på profil-refetch — då skulle en bakgrundsuppdatering
  // nollställa datum, platstyp, meddelande och rekryterarens inskrivna länk.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSubject(`Intervju för ${jobTitle}`);
      setDate(new Date());
      const remembered = readRememberedLocationType(applicationId);
      setLocationType(remembered);
      setMessage(remembered === 'office' ? officeDefaultMessage : videoDefaultMessage);
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
      // Exakt skickad tid – även icke-kvartartider som 20:07 – så att
      // "samma tid"-skyddet och förifyllningen alltid motsvarar verkligheten.
      setTime(`${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`);
    }
    setDuration(String(existingInterview.duration_minutes || 30));
    const type = existingInterview.location_type === 'office' ? 'office' : 'video';
    setLocationType(type);
    rememberLocationType(applicationId, type);
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

  const selectedScheduledAt = React.useMemo(() => {
    if (!date) return null;
    const [h, m] = time.split(':').map(Number);
    const value = new Date(date);
    value.setHours(h, m, 0, 0);
    return value;
  }, [date, time]);

  // Redan skickad tid med oförändrat innehåll = inget att skicka om.
  const isUnchangedFromExisting = React.useMemo(() => {
    if (!isReschedule || !existingInterview || !selectedScheduledAt) return false;
    if (new Date(existingInterview.scheduled_at).getTime() !== selectedScheduledAt.getTime()) return false;
    if ((existingInterview.duration_minutes || 30) !== parseInt(duration)) return false;
    const existingType = existingInterview.location_type === 'office' ? 'office' : 'video';
    if (existingType !== locationType) return false;
    const nextDetails =
      locationType === 'video'
        ? normalizeMeetingLink(editableVideoLink || locationDetails || '')
        : locationDetails || '';
    const prevDetails =
      existingType === 'video'
        ? normalizeMeetingLink(existingInterview.location_details || '')
        : existingInterview.location_details || '';
    if ((nextDetails || '') !== (prevDetails || '')) return false;
    if ((subject || '') !== (existingInterview.subject || '')) return false;
    if ((message || '') !== (existingInterview.message || '')) return false;
    return true;
  }, [
    isReschedule,
    existingInterview,
    selectedScheduledAt,
    duration,
    locationType,
    editableVideoLink,
    locationDetails,
    subject,
    message,
  ]);


  const handleSubmit = async () => {
    if (!user || !date) {
      toast.error('Välj ett datum för intervjun');
      return;
    }

    if (lockedByColleague) {
      toast.error('Mötet är bokat av en kollega', {
        description: 'Bara den som bokade mötet kan boka om eller avboka det.',
      });
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

    // Samma tid och samma innehåll som redan är skickat ska inte kunna skickas igen.
    if (isUnchangedFromExisting) {
      toast.error('Tiden är redan skickad', {
        description: 'Välj en ny tid innan du skickar om intervjun.',
      });
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

      const insertInterview = () =>
        supabase.from('interviews').insert({
          job_id: jobId,
          applicant_id: candidateId,
          application_id: applicationId,
          employer_id: user.id,
          ...interviewFields,
          status: 'pending',
        }).select('id').single();

      // Ombokning uppdaterar samma möte – annars får kandidaten två
      // kalenderposter och två intervjuer i sina listor.
      let { data: interviewRow, error } = isReschedule && existingInterview
        ? await supabase
            .from('interviews')
            // Ingen employer_id-filtrering: en kollega i samma organisation ska
            // kunna boka om ett redan bokat möte i stället för att skapa ett nytt.
            .update({ ...interviewFields, status: 'pending' })
            .eq('id', existingInterview.id)
            .select('id')
            .single()
        : await insertInterview();

      // Databasen tillåter bara en aktiv intervju per ansökan. Ett möte som
      // redan är över kan ligga kvar som pending/confirmed tills nattjobbet
      // hinner stänga det – då ska en andra intervjuomgång ändå gå att boka.
      if (error && (error as { code?: string }).code === '23505' && !isReschedule) {
        const { data: blockers } = await supabase
          .from('interviews')
          .select('id, scheduled_at, duration_minutes')
          .eq('application_id', applicationId)
          .in('status', ['pending', 'confirmed']);

        const stale = (blockers || []).filter(
          (row) =>
            new Date(row.scheduled_at).getTime() + (row.duration_minutes || 30) * 60_000 <= Date.now(),
        );

        if (stale.length > 0 && stale.length === (blockers || []).length) {
          const { error: closeError } = await supabase
            .from('interviews')
            .update({ status: 'completed' })
            .in('id', stale.map((row) => row.id))
            .select('id');
          if (!closeError) {
            ({ data: interviewRow, error } = await insertInterview());
          }
        }
      }

      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('En kollega har precis bokat ett möte med kandidaten. Bara den som bokade mötet kan ändra tiden.');
        }
        // Noll rader tillbaka = behörighetsreglerna nekade ändringen, dvs. mötet
        // tillhör en kollega.
        if ((error as { code?: string }).code === 'PGRST116' && isReschedule) {
          throw new Error('Mötet är bokat av en kollega. Bara den som bokade det kan boka om eller avboka.');
        }
        throw error;
      }


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

      // Bokningen är nu säkrad i databasen. Först här stängs dialogen och
      // bekräftelsen visas – går något fel dessförinnan står rekryteraren kvar
      // i dialogen med sitt innehåll. Mejl och kalender körs sedan i bakgrunden.
      const interviewId = interviewRow?.id;
      // Nästa gång dialogen öppnas för samma kandidat står rätt flik direkt.
      rememberLocationType(applicationId, locationType);
      handleOpenChange(false);
      setIsSubmitting(false);

      toast.success(
        isReschedule ? `Intervju ombokad för ${candidateName}` : `Intervju bokad för ${candidateName}`,
        {
          description: isReschedule
            ? 'Den nya tiden skickas till kandidaten.'
            : 'Kallelsen med kalenderinbjudan skickas till kandidaten.',
          route: '/my-candidates',
        } as Parameters<typeof toast.success>[1],
      );

      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['existing-interview', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['candidate-activities'] });
      onSuccess?.();

      // Starta det kritiska kandidatmejlet innan kontrollen lämnas tillbaka till
      // webbläsaren. Då har nätverksanropet redan skickats även om användaren
      // byter sida direkt efter att dialogen stängts.
      let invitationPromise: Promise<{ data: any; error: any }> | null = null;
      if (interviewId && !isReschedule) {
        invitationPromise = supabase.functions.invoke('send-interview-invitation', {
          body: {
            candidateEmail: user?.email || 'bound-to-application@parium.invalid',
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
            interviewId,
            sendEmail: true,
          },
        });
      }

      void (async () => {
        let deliveryFailed = false;

        // 1. Send the interview invitation email with .ics calendar attachment
        try {
          if (invitationPromise) {
            const { data: invitationResult, error: invitationError } = await invitationPromise;
            if (invitationError) throw invitationError;
            if (invitationResult?.candidate?.sent === false) {
              throw new Error('candidate_email_not_sent');
            }
          }
        } catch (emailErr) {
          console.error('Error sending interview email:', emailErr);
          deliveryFailed = true;
        }

        // 2. Trigger outreach automations (chat, push, etc.)
        try {
          const { error: dispatchError } = await supabase.functions.invoke('outreach-dispatch', {
            body: {
              processPending: true,
              trigger: 'interview_scheduled',
              interviewId,
            },
          });
          if (dispatchError) throw dispatchError;
        } catch (dispatchErr) {
          console.error('Error invoking outreach-dispatch:', dispatchErr);
          deliveryFailed = true;
        }

        if (deliveryFailed) {
          toast.error('Tiden är sparad, men utskicket gick inte fram', {
            description: 'Öppna intervjun igen och skicka om den – ändra t.ex. meddelandet så får kandidaten kallelsen.',
          });
        }
      })();
    } catch (error) {
      console.error('Error creating interview:', error);
      const reason = error instanceof Error ? error.message : undefined;
      toast.error(isReschedule ? 'Kunde inte boka om intervjun' : 'Kunde inte boka intervjun', {
        description: reason,
      });
      setIsSubmitting(false);
    }
  };

  // Generate time options (every 15 min, full 24 hours) — stabil referens.
  const allTimeOptions = React.useMemo(() => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return options;
  }, []);

  // Klockan tickar med i minuttakt så listan aldrig visar en tid som redan
  // passerat — och så att dagen byts korrekt när man sitter nära midnatt.
  const [minuteTick, setMinuteTick] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setMinuteTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [open]);

  // Tiden som redan är skickad till kandidaten är förbrukad – den ska inte gå
  // att välja igen på samma dag, annars skickar man om exakt samma kallelse.
  const usedTimeOnSelectedDate = React.useMemo(() => {
    if (!isReschedule || !existingInterview || !date) return null;
    const sent = new Date(existingInterview.scheduled_at);
    if (Number.isNaN(sent.getTime())) return null;
    if (startOfDay(sent).getTime() !== startOfDay(date).getTime()) return null;
    return `${String(sent.getHours()).padStart(2, '0')}:${String(Math.floor(sent.getMinutes() / 15) * 15).padStart(2, '0')}`;
  }, [isReschedule, existingInterview, date]);

  // Filter times if today is selected - only show future times
  const timeOptions = React.useMemo(() => {
    const base = usedTimeOnSelectedDate
      ? allTimeOptions.filter((t) => t !== usedTimeOnSelectedDate)
      : allTimeOptions;
    if (!date || !isToday(date)) return base;
    const now = new Date(minuteTick);
    return base.filter(t => {
      const [hours, minutes] = t.split(':').map(Number);
      const timeDate = new Date(now);
      timeDate.setHours(hours, minutes, 0, 0);
      return timeDate > now;
    });
  }, [allTimeOptions, date, minuteTick, usedTimeOnSelectedDate]);

  // Nära midnatt finns ingen tid kvar i dag. Då hoppar vi automatiskt fram till
  // nästa dag i stället för att visa en tom, otryckbar lista.
  React.useEffect(() => {
    if (!date || !isToday(date) || timeOptions.length > 0) return;
    const tomorrow = startOfDay(new Date(minuteTick));
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow);
    setTime('09:00');
  }, [date, timeOptions.length, minuteTick]);

  // Fritt tidsfält: rekryteraren kan skriva vilken minut som helst (t.ex.
  // 20:07). Snabblistan med kvartartider finns kvar som genväg.
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState(time);

  const openTimePopover = (nextOpen: boolean) => {
    setTimePopoverOpen(nextOpen);
    if (nextOpen) setTimeDraft(time);
  };

  // Endast siffror – max fyra – och kolon sätts automatiskt, exakt som brickorna (HH:MM).
  const handleTimeDraftChange = (value: string) => {
    let digits = value.replace(/\D/g, '').slice(0, 4);
    // "930" ska bli 09:30 – en första siffra över 2 kan aldrig vara en timme.
    if (digits.length >= 2 && Number(digits[0]) > 2) digits = `0${digits}`.slice(0, 4);
    setTimeDraft(digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`);
  };

  // Tolkar "20", "20:", "20:0", "930" och "2007" och normaliserar till HH:MM.
  // Returnerar false vid en ogiltig tid – då står det gamla värdet kvar.
  const commitTimeDraft = (raw: string): boolean => {
    const cleaned = raw.replace(/[^0-9:]/g, '');
    let hours: number;
    let minutes = 0;
    if (cleaned.includes(':')) {
      const [h, m = ''] = cleaned.split(':');
      if (!h) return false;
      hours = parseInt(h, 10);
      if (m) minutes = parseInt(m.padEnd(2, '0'), 10);
    } else if (cleaned.length <= 2) {
      if (!cleaned) return false;
      hours = parseInt(cleaned, 10);
    } else if (cleaned.length === 3) {
      hours = parseInt(cleaned.slice(0, 1), 10);
      minutes = parseInt(cleaned.slice(1), 10);
    } else {
      hours = parseInt(cleaned.slice(0, 2), 10);
      minutes = parseInt(cleaned.slice(2), 10);
    }
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return false;
    const normalized = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setTime(normalized);
    setTimeDraft(normalized);
    return true;
  };

  // Har den valda tiden passerat medan dialogen stått öppen hoppar vi fram
  // till nästa lediga tid. Egen skrivna tider lämnas orörda så länge de
  // ligger framåt i tiden.
  React.useEffect(() => {
    if (!date || !isToday(date)) return;
    const [h, m] = time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    const selected = new Date(date);
    selected.setHours(h, m, 0, 0);
    if (selected.getTime() > Date.now()) return;
    if (timeOptions.length > 0) {
      setTime(timeOptions[0]);
    } else {
      const tomorrow = startOfDay(new Date());
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow);
      setTime('09:00');
    }
  }, [date, time, minuteTick, timeOptions]);

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
        className="parium-panel max-w-none min-w-0 w-[min(92vw,500px)] max-h-[85vh] bg-parium-gradient text-white border-none shadow-none rounded-[24px] sm:rounded-xl overflow-hidden p-0 flex flex-col"
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        onTouchCancel={(event) => event.stopPropagation()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle className="sr-only">{isReschedule ? 'Boka om intervju' : 'Boka intervju'}</DialogTitle>
          <DialogDescription className="sr-only">Skicka en intervjukallelse till {candidateName}.</DialogDescription>
        </DialogHeader>
        <AnimatedBackground showBubbles={false} />

        <div className="relative z-10 flex min-w-0 max-w-full flex-col max-h-[85vh] overflow-x-hidden">
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

          <div className="flex-1 min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain p-5 space-y-4">
            <Popover open={summaryTooltipOpen} onOpenChange={setSummaryTooltipOpen}>
              <PopoverTrigger asChild>
                <p
                  ref={invitationSummaryRef}
                  onClick={() => {
                    if (!invitationSummaryTruncated) setSummaryTooltipOpen(false);
                  }}
                  className={`max-w-full text-white text-center text-sm leading-snug break-words [overflow-wrap:anywhere] line-clamp-4 ${invitationSummaryTruncated ? 'cursor-pointer touch-manipulation' : 'pointer-events-none'}`}
                >
                  {lockedByColleague
                    ? `Intervjun med ${candidateName} är bokad av en kollega. Bara den som bokade mötet kan ändra tiden eller avboka.`
                    : isReschedule
                      ? `Ändra tid eller plats för intervjun med ${candidateName} – ${jobTitle}. Kandidaten får en ny kallelse och kalenderinbjudan.`
                      : `Skicka en intervjukallelse till ${candidateName} för tjänsten ${jobTitle}`}
                </p>
              </PopoverTrigger>
              {invitationSummaryTruncated && (
                <PopoverContent
                  side="bottom"
                  align="center"
                  collisionPadding={16}
                  className="z-[999999] w-[min(22rem,86vw)] whitespace-normal break-words [overflow-wrap:anywhere] text-sm leading-snug text-white"
                >
                  {jobTitle}
                </PopoverContent>
              )}
            </Popover>


          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-white">Datum</Label>
            <Popover modal open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
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
              <PopoverContent
                className="w-auto max-h-[min(24rem,60dvh)] overflow-y-auto overscroll-contain p-0 pointer-events-auto z-[120] text-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                align="center"
                side="bottom"
                sideOffset={4}
                avoidCollisions={false}
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(day) => {
                    if (!day) return;
                    setDate(day);
                    // Premiumkänsla: menyn stängs direkt när dagen är vald.
                    setDatePopoverOpen(false);
                  }}
                  disabled={(day) => {
                    // Inget bakåt i tiden, och som mest 12 månader fram –
                    // ett feltryck ska inte kunna boka ett möte år 2031.
                    const maxDate = new Date();
                    maxDate.setMonth(maxDate.getMonth() + 12);
                    return day < startOfDay(new Date()) || day > maxDate;
                  }}
                  initialFocus
                  className="pointer-events-auto touch-manipulation"
                  classNames={{
                    day_today: "", // Remove today highlight
                    caption_label: "text-sm font-medium text-white",
                    day_outside: "day-outside text-white/40 opacity-100",
                    day_disabled: "text-white/30 opacity-100",
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time and duration */}
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.25rem] sm:grid-cols-[minmax(0,1fr)_8rem] gap-3 items-end">
            <div className="min-w-0 space-y-2">
              <Label className="text-white">Tid</Label>
              <Popover open={timePopoverOpen} onOpenChange={openTimePopover}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-[var(--control-height)] flex items-center justify-start text-left text-sm font-normal bg-white/10 border border-white/20 rounded-md px-3 py-2 text-white transition-colors hover:border-white/30"
                  >
                    <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{time} →{endTime}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(20rem,84vw)] p-3 pointer-events-auto z-[120]"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  // Ligger alltid under tidsfältet – annars vänder den upp över
                  // fältet när mobilens tangentbord krymper vyn.
                  avoidCollisions={false}
                  // Inget autofokus: tangentbordet ska inte slå upp direkt när
                  // menyn öppnas, utan först när man trycker i fältet.
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Input
                    value={timeDraft}
                    onChange={(e) => handleTimeDraftChange(e.target.value)}
                    onBlur={() => commitTimeDraft(timeDraft)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (commitTimeDraft(timeDraft)) setTimePopoverOpen(false);
                      }
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={5}
                    placeholder="HH:MM"
                    className="h-11 bg-white/10 border-white/20 text-base text-white placeholder:text-white/50"
                  />
                  <p className="mt-1.5 text-xs leading-snug text-white">
                    Skriv valfri tid eller välj en kvartartid nedan.
                  </p>
                  <div
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                    className="mt-2 max-h-[min(44vh,220px)] overflow-y-auto overscroll-contain scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    <div className="grid grid-cols-4 gap-1.5">
                      {timeOptions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setTime(t);
                            setTimeDraft(t);
                            setTimePopoverOpen(false);
                          }}
                          className={cn(
                            'h-9 rounded-md border text-sm transition-colors focus:outline-none focus:ring-0',
                            t === time
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'bg-white/10 border-white/20 text-white hover:border-white/30'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="min-w-0 space-y-2 w-full shrink-0">
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
          <div className="min-w-0 space-y-2">
            <Label className="text-white">Plats</Label>
            <div className="grid min-w-0 grid-cols-2 gap-2">
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

          {/* Subject */}
          <div className="min-w-0 space-y-2">
            <Label className="text-white">Ämnesrad</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ämne för intervjukallelsen"
              className="min-w-0 max-w-full bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>

          {/* Video link input */}
          {locationType === 'video' && (
            <div className="min-w-0 space-y-2">
              <Label className="text-white">Videolänk</Label>

              {trimmedVideoLink && !videoLinkEditing ? (
                <div className="min-w-0 max-w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 flex items-center gap-2.5 overflow-hidden">
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


          {/* Location details */}
          {locationType === 'office' && (
            <div className="min-w-0 space-y-2">
              <Label className="text-white">Adress</Label>
              <Input
                value={editableAddress}
                onChange={(e) => setEditableAddress(e.target.value)}
                placeholder="Ange adress för mötet"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
          )}

          {locationType === 'office' && officeInstructions && (
            <div className="min-w-0 space-y-2">
              <Label className="text-white">Instruktioner till kandidaten</Label>
              <div className="min-w-0 max-w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5">
                <p className="text-sm leading-5 text-white whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {officeInstructions}
                </p>
              </div>
            </div>
          )}

          {/* Message */}
          <div className="min-w-0 space-y-2">
            <Label className="text-white">Meddelande till kandidaten</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ett personligt meddelande..."
              rows={4}
              className="min-w-0 max-w-full bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            </div>

            {/* Actions */}
            {isUnchangedFromExisting && !lockedByColleague && (
              <p className="pt-3 text-sm text-white">
                Den här tiden är redan skickad. Välj en ny tid för att skicka om intervjun.
              </p>
            )}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => handleSubmit()} 
                onMouseDown={(e) => e.currentTarget.blur()}
                onMouseUp={(e) => e.currentTarget.blur()}
                disabled={isSubmitting || !date || lockedByColleague || isUnchangedFromExisting}
                // Ramen ligger kvar hela tiden (bara färgen byts) så knappen
                // aldrig hoppar eller blinkar när man byter plats eller tid.
                className="flex-1 min-h-[44px] rounded-full border border-white/30 transition-none active:scale-95 focus:outline-none focus:ring-0 disabled:border-white/10"
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
