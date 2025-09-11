export interface EmploymentType {
  value: string;
  label: string;
  description?: string;
}

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  { value: 'full_time', label: 'Heltid', description: 'Heltidsanställning' },
  { value: 'part_time', label: 'Deltid', description: 'Deltidsanställning' },
  { value: 'contract', label: 'Konsult', description: 'Konsultuppdrag' },
  { value: 'temporary', label: 'Vikariat', description: 'Tillfällig anställning' },
  { value: 'internship', label: 'Praktik', description: 'Praktikplats' },
  { value: 'summer_job', label: 'Sommarjobb', description: 'Sommaranställning' }
];

export const getEmploymentTypeLabel = (value?: string): string => {
  if (!value) return '';
  const type = EMPLOYMENT_TYPES.find(t => t.value === value);
  return type ? type.label : value;
};

export const getEmploymentTypeByLabel = (label: string): EmploymentType | undefined => {
  return EMPLOYMENT_TYPES.find(t => t.label === label);
};

// For backward compatibility with existing data that might use display labels
export const normalizeEmploymentType = (value: string): string => {
  // If it's already a code value, return as is
  if (EMPLOYMENT_TYPES.some(t => t.value === value)) {
    return value;
  }
  
  // If it's a display label, convert to code
  const type = getEmploymentTypeByLabel(value);
  return type ? type.value : value;
};

// For search functionality - includes both Swedish display labels and code values
export const SEARCH_EMPLOYMENT_TYPES = EMPLOYMENT_TYPES.map(type => ({
  value: type.label, // Use label for search display
  label: type.label,
  code: type.value // Keep code for database queries
}));