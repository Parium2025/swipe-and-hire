import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimeInputFieldProps {
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
  required?: boolean;
}

// Format time input: auto-insert colon after 2 digits, limit to 5 chars
const formatTimeInput = (value: string): string => {
  // Remove non-digits
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

// Format time on blur: zero-pad partial inputs
const formatTimeOnBlur = (value: string): string => {
  if (!value) return '';
  
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length === 1) return `0${digits}:00`;
  if (digits.length === 2) return `${digits}:00`;
  if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2)}0`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

export const TimeInputField = ({
  label,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startPlaceholder = '08:00',
  endPlaceholder = '17:00',
  required = false,
}: TimeInputFieldProps) => {
  const endInputRef = useRef<HTMLInputElement>(null);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(e.target.value);
    onStartChange(formatted);
    
    // Auto-focus end input when start is complete
    if (formatted.length === 5 && endInputRef.current) {
      endInputRef.current.focus();
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(e.target.value);
    onEndChange(formatted);
  };

  const handleStartBlur = () => {
    if (startValue) {
      onStartChange(formatTimeOnBlur(startValue));
    }
  };

  const handleEndBlur = () => {
    if (endValue) {
      onEndChange(formatTimeOnBlur(endValue));
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-white text-sm font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          value={startValue}
          onChange={handleStartChange}
          onBlur={handleStartBlur}
          placeholder={startPlaceholder}
          maxLength={5}
          className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/50 h-11 text-sm focus:border-white/40"
        />
        <span className="text-white">–</span>
        <Input
          ref={endInputRef}
          value={endValue}
          onChange={handleEndChange}
          onBlur={handleEndBlur}
          placeholder={endPlaceholder}
          maxLength={5}
          className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/50 h-11 text-sm focus:border-white/40"
        />
      </div>
    </div>
  );
};

export default TimeInputField;
