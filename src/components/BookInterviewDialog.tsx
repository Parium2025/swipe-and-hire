import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, MapPin, Video, Building2, Loader2, X } from 'lucide-react';
import { format, startOfDay, isToday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface BookInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  onSuccess?: () => void;
}

const DEFAULT_MESSAGE = `Hej!

Tack för din ansökan. Vi skulle gärna vilja träffa dig på en intervju.

Vänliga hälsningar`;

export const BookInterviewDialog = ({
  open,
  onOpenChange,
  candidateName,
  candidateId,
  applicationId,
  jobId,
  jobTitle,
  onSuccess,
}: BookInterviewDialogProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [locationType, setLocationType] = useState<'video' | 'office'>('video');
  const [locationDetails, setLocationDetails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  // Get employer's office address from profile
  const officeAddress = profile?.address || '';
  const companyName = profile?.company_name || '';

  // Set default subject when dialog opens
  useEffect(() => {
    if (open) {
      setSubject(`Intervju för ${jobTitle}`);
      // Reset form with today as default date
      setDate(new Date());
      setTime('10:00');
      setDuration('30');
      setLocationType('video');
      setLocationDetails('');
      setMessage(DEFAULT_MESSAGE);
    }
  }, [open, jobTitle]);

  // Update location details when type changes
  useEffect(() => {
    if (locationType === 'office' && officeAddress) {
      setLocationDetails(officeAddress);
    } else if (locationType === 'video') {
      setLocationDetails('Videosamtal via Parium');
    }
  }, [locationType, officeAddress]);

  const handleSubmit = async () => {
    if (!user || !date) {
      toast.error('Välj ett datum för intervjun');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledAt = new Date(date);
      scheduledAt.setHours(hours, minutes, 0, 0);

      // Create interview
      const { error } = await supabase.from('interviews').insert({
        job_id: jobId,
        applicant_id: candidateId,
        application_id: applicationId,
        employer_id: user.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(duration),
        location_type: locationType,
        location_details: locationDetails || null,
        subject: subject || null,
        message: message || null,
        status: 'pending',
      });

      if (error) throw error;

      toast.success(`Intervjukallelse skickad till ${candidateName}`);
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating interview:', error);
      toast.error('Kunde inte boka intervjun');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus 
        hideClose
        className="w-[min(90vw,480px)] bg-card-parium text-white backdrop-blur-md border-white/20 max-h-[85vh] shadow-lg rounded-[24px] sm:rounded-xl overflow-hidden flex flex-col"
      >
        <DialogHeader className="px-5 pt-5 pb-3 relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-0 top-0 h-8 w-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogTitle className="flex items-center gap-2 text-white text-xl">
            <CalendarIcon className="h-5 w-5" />
            Boka intervju
          </DialogTitle>
          <DialogDescription className="text-white">
            Skicka en intervjukallelse till {candidateName} för tjänsten {jobTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-5 overflow-y-auto flex-1 min-h-0">
          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-white">Datum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center justify-start text-left font-normal bg-white/10 border border-white/20 rounded-md px-3 py-2 transition-colors hover:border-white/30",
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
              <PopoverContent className="w-auto p-0" align="center" side="bottom" sideOffset={4} avoidCollisions={false}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < startOfDay(new Date())}
                  initialFocus
                  className="pointer-events-auto"
                  classNames={{
                    day_today: "" // Remove today highlight
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time and duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Tid</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white [&>svg]:text-white">
                  <Clock className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{time} → {endTime}</span>
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
            <div className="space-y-2">
              <Label className="text-white">Längd</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white [&>svg]:text-white">
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

          {/* Location type */}
          <div className="space-y-2">
            <Label className="text-white">Plats</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors",
                  locationType === 'video' 
                    ? "bg-white/20 border-white/40 text-white" 
                    : "bg-white/10 border-white/20 text-white/80 hover:text-white hover:border-white/30"
                )}
                onClick={() => setLocationType('video')}
              >
                <Video className="h-3.5 w-3.5" />
                <span>Video</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors",
                  locationType === 'office' 
                    ? "bg-white/20 border-white/40 text-white" 
                    : "bg-white/10 border-white/20 text-white/80 hover:text-white hover:border-white/30"
                )}
                onClick={() => setLocationType('office')}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Kontor</span>
              </button>
            </div>
          </div>

          {/* Location details */}
          {locationType === 'office' && (
            <div className="space-y-2">
              <Label className="text-white">Adress</Label>
              <Input
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                placeholder="Ange adress för mötet"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
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
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3 px-5 pb-5 pt-2 border-t border-white/10">
          <Button 
            variant="glass" 
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
          <Button 
            variant="glass"
            onClick={handleSubmit} 
            disabled={isSubmitting || !date}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Skickar...
              </>
            ) : (
              'Skicka intervjukallelse'
            )}
          </Button>
        </div>
      </DialogContentNoFocus>
    </Dialog>
  );
};
