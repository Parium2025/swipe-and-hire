import { z } from 'zod';

// Enhanced input validation schemas
export const jobFormSchema = z.object({
  title: z.string()
    .trim()
    .min(2, { message: "Jobbtitel måste vara minst 2 tecken" })
    .max(100, { message: "Jobbtitel får vara max 100 tecken" })
    .regex(/^[a-zA-ZåäöÅÄÖ0-9\s\-\(\)\/\+\.,&]+$/, { 
      message: "Jobbtitel innehåller ogiltiga tecken" 
    }),
  
  description: z.string()
    .trim()
    .min(20, { message: "Jobbeskrivning måste vara minst 20 tecken" })
    .max(5000, { message: "Jobbeskrivning får vara max 5000 tecken" }),
  
  occupation: z.string()
    .trim()
    .min(2, { message: "Yrke måste vara minst 2 tecken" })
    .max(100, { message: "Yrke får vara max 100 tecken" }),
  
  employment_type: z.string()
    .min(1, { message: "Anställningsform är obligatorisk" }),
  
  positions_count: z.string()
    .regex(/^[1-9]\d*$/, { message: "Antal personer måste vara ett positivt tal" })
    .transform(val => parseInt(val))
    .refine(val => val >= 1 && val <= 999, { 
      message: "Antal personer måste vara mellan 1-999" 
    }),
  
  workplace_postal_code: z.string()
    .regex(/^\d{3}\s?\d{2}$/, { message: "Ogiltigt postnummer (format: 12345)" })
    .optional()
    .or(z.literal('')),
  
  contact_email: z.string()
    .trim()
    .email({ message: "Ogiltig e-postadress" })
    .max(255, { message: "E-post får vara max 255 tecken" })
    .optional()
    .or(z.literal('')),
});

// Safe input handlers with validation
export const createSafeInputHandler = (
  field: string,
  setValue: (field: string, value: any) => void,
  validation?: z.ZodSchema
) => {
  return (value: string) => {
    try {
      // Basic sanitization
      const sanitized = value
        .replace(/[<>]/g, '') // Remove potential HTML
        .trim();
      
      // Apply validation if provided
      if (validation) {
        const result = validation.safeParse(sanitized);
        if (!result.success) {
          console.warn(`Validation failed for ${field}:`, result.error.errors);
          return;
        }
      }
      
      setValue(field, sanitized);
    } catch (error) {
      console.error(`Error handling input for ${field}:`, error);
    }
  };
};

// URL parameter encoding for external services
export const encodeForURL = (text: string): string => {
  return encodeURIComponent(text.slice(0, 500)); // Limit length for URLs
};

// Validate before external API calls
export const validateBeforeExternalCall = (data: Record<string, any>) => {
  const errors: string[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string') {
      if (value.length > 1000) {
        errors.push(`${key} är för långt (max 1000 tecken)`);
      }
      if (/<script|javascript:|data:|vbscript:/i.test(value)) {
        errors.push(`${key} innehåller otillåtet innehåll`);
      }
    }
  });
  
  return errors;
};