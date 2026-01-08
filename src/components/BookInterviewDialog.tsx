import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, MapPin, Video, Phone, Building2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
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
  const [locationType, setLocationType] = useState<'video' | 'office' | 'phone'>('video');
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
      // Reset form
      setDate(undefined);
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
    } else if (locationType === 'phone') {
      setLocationDetails('');
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

  // Generate time options (every 30 min from 07:00 to 20:00)
  const timeOptions = [];
  for (let h = 7; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeOptions.push(timeStr);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Boka intervju
          </DialogTitle>
          <DialogDescription>
            Skicka en intervjukallelse till {candidateName} för tjänsten {jobTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label>Datum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'EEEE d MMMM yyyy', { locale: sv }) : 'Välj datum'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time and duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tid</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Längd</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            <Label>Plats</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={locationType === 'video' ? 'default' : 'outline'}
                className="flex flex-col h-auto py-3 gap-1"
                onClick={() => setLocationType('video')}
              >
                <Video className="h-4 w-4" />
                <span className="text-xs">Video</span>
              </Button>
              <Button
                type="button"
                variant={locationType === 'office' ? 'default' : 'outline'}
                className="flex flex-col h-auto py-3 gap-1"
                onClick={() => setLocationType('office')}
              >
                <Building2 className="h-4 w-4" />
                <span className="text-xs">Kontor</span>
              </Button>
              <Button
                type="button"
                variant={locationType === 'phone' ? 'default' : 'outline'}
                className="flex flex-col h-auto py-3 gap-1"
                onClick={() => setLocationType('phone')}
              >
                <Phone className="h-4 w-4" />
                <span className="text-xs">Telefon</span>
              </Button>
            </div>
          </div>

          {/* Location details */}
          {(locationType === 'office' || locationType === 'phone') && (
            <div className="space-y-2">
              <Label>
                {locationType === 'office' ? 'Adress' : 'Telefonnummer'}
              </Label>
              <Input
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                placeholder={
                  locationType === 'office' 
                    ? 'Ange adress för mötet' 
                    : 'Ange telefonnummer att ringa'
                }
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label>Ämnesrad</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ämne för intervjukallelsen"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Meddelande till kandidaten</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ett personligt meddelande..."
              rows={4}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !date}>
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
      </DialogContent>
    </Dialog>
  );
};
