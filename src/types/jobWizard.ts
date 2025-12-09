// Shared types for job wizard and template wizard components

export interface JobQuestion {
  id?: string;
  template_id?: string;
  question_text: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
  options?: string[];
  is_required: boolean;
  order_index: number;
  min_value?: number;
  max_value?: number;
  placeholder_text?: string;
  usage_count?: number;
}

export interface BaseFormData {
  title: string;
  description: string;
  requirements: string;
  location: string;
  occupation: string;
  salary_min: string;
  salary_max: string;
  employment_type: string;
  salary_type: string;
  salary_transparency: string;
  positions_count: string;
  work_location_type: string;
  remote_work_possible: string;
  workplace_name: string;
  workplace_address: string;
  workplace_postal_code: string;
  workplace_city: string;
  work_schedule: string;
  contact_email: string;
  application_instructions: string;
  pitch: string;
  benefits: string[];
}

export interface JobFormData extends BaseFormData {
  work_start_time: string;
  work_end_time: string;
  job_image_url: string;
}

export interface TemplateFormData extends BaseFormData {
  name: string;
  work_start_time: string;
  work_end_time: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  occupation?: string;
  employment_type?: string;
  work_schedule?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  salary_transparency?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  workplace_name?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_city?: string;
  positions_count?: string;
  pitch?: string;
  contact_email?: string;
  application_instructions?: string;
  category?: string;
  is_default: boolean;
  benefits?: string[];
  questions?: JobQuestion[];
}

// Dropdown option types
export interface DropdownOption {
  value: string;
  label: string;
}

// Question type options
export const QUESTION_TYPES: DropdownOption[] = [
  { value: 'text', label: 'Fritext' },
  { value: 'yes_no', label: 'Ja/Nej' },
  { value: 'multiple_choice', label: 'Flerval' },
  { value: 'number', label: 'Siffra' },
  { value: 'range', label: 'Intervall' },
  { value: 'date', label: 'Datum' },
  { value: 'file', label: 'Fil' },
  { value: 'video', label: 'Video' },
];

export const getQuestionTypeLabel = (type: string): string => {
  const found = QUESTION_TYPES.find(q => q.value === type);
  return found?.label || type;
};

// Salary type options
export const SALARY_TYPES: DropdownOption[] = [
  { value: 'monthly', label: 'Månadslön' },
  { value: 'hourly', label: 'Timlön' },
  { value: 'fixed', label: 'Fast lön' },
  { value: 'commission', label: 'Provision' },
];

export const getSalaryTypeLabel = (type: string): string => {
  const found = SALARY_TYPES.find(s => s.value === type);
  return found?.label || type;
};

// Salary transparency options
export const SALARY_TRANSPARENCY_OPTIONS: DropdownOption[] = [
  { value: '0-5000', label: '0 - 5 000 kr' },
  { value: '5000-10000', label: '5 000 - 10 000 kr' },
  { value: '10000-15000', label: '10 000 - 15 000 kr' },
  { value: '15000-20000', label: '15 000 - 20 000 kr' },
  { value: '20000-25000', label: '20 000 - 25 000 kr' },
  { value: '25000-30000', label: '25 000 - 30 000 kr' },
  { value: '30000-40000', label: '30 000 - 40 000 kr' },
  { value: '40000-45000', label: '40 000 - 45 000 kr' },
  { value: '45000-50000', label: '45 000 - 50 000 kr' },
  { value: '50000-55000', label: '50 000 - 55 000 kr' },
  { value: '55000-60000', label: '55 000 - 60 000 kr' },
  { value: '60000-65000', label: '60 000 - 65 000 kr' },
  { value: '65000-70000', label: '65 000 - 70 000 kr' },
  { value: '70000-75000', label: '70 000 - 75 000 kr' },
  { value: '75000-80000', label: '75 000 - 80 000 kr' },
  { value: '80000-85000', label: '80 000 - 85 000 kr' },
  { value: '85000-90000', label: '85 000 - 90 000 kr' },
  { value: '90000-100000', label: '90 000 - 100 000 kr' },
  { value: '100000+', label: '100 000+ kr' },
];

export const getSalaryTransparencyLabel = (value: string): string => {
  const found = SALARY_TRANSPARENCY_OPTIONS.find(s => s.value === value);
  return found?.label || value;
};

// Work location options
export const WORK_LOCATION_TYPES: DropdownOption[] = [
  { value: 'på-plats', label: 'På plats' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Distans' },
];

export const getWorkLocationLabel = (type: string): string => {
  const found = WORK_LOCATION_TYPES.find(w => w.value === type);
  return found?.label || type;
};

// Remote work options
export const REMOTE_WORK_OPTIONS: DropdownOption[] = [
  { value: 'ja', label: 'Ja' },
  { value: 'nej', label: 'Nej' },
  { value: 'delvis', label: 'Delvis' },
];

export const getRemoteWorkLabel = (value: string): string => {
  const found = REMOTE_WORK_OPTIONS.find(r => r.value === value);
  return found?.label || value;
};

// Benefits options
export const BENEFITS_OPTIONS: DropdownOption[] = [
  { value: 'forsakringar', label: 'Försäkringar' },
  { value: 'fri-fika-frukt', label: 'Fri fika/frukt' },
  { value: 'utbildning', label: 'Utbildning' },
  { value: 'flexibla-arbetstider', label: 'Flexibla arbetstider' },
  { value: 'kollektivavtal', label: 'Kollektivavtal' },
  { value: 'fri-parkering', label: 'Fri parkering' },
  { value: 'personalrabatter', label: 'Personalrabatter' },
  { value: 'friskvardsbidrag', label: 'Friskvårdsbidrag' },
  { value: 'pension', label: 'Pension' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'tjänstebil', label: 'Tjänstebil' },
  { value: 'hemarbete', label: 'Hemarbete' },
];

export const getBenefitLabel = (value: string): string => {
  const found = BENEFITS_OPTIONS.find(b => b.value === value);
  return found?.label || value;
};

// Empty form data factory
export const createEmptyJobFormData = (): JobFormData => ({
  title: '',
  description: '',
  requirements: '',
  location: '',
  occupation: '',
  salary_min: '',
  salary_max: '',
  employment_type: '',
  salary_type: '',
  salary_transparency: '',
  positions_count: '1',
  work_location_type: 'på-plats',
  remote_work_possible: 'nej',
  workplace_name: '',
  workplace_address: '',
  workplace_postal_code: '',
  workplace_city: '',
  work_schedule: '',
  work_start_time: '',
  work_end_time: '',
  contact_email: '',
  application_instructions: '',
  pitch: '',
  benefits: [],
  job_image_url: '',
});

export const createEmptyTemplateFormData = (): TemplateFormData => ({
  name: '',
  title: '',
  description: '',
  requirements: '',
  location: '',
  occupation: '',
  salary_min: '',
  salary_max: '',
  employment_type: '',
  salary_type: '',
  salary_transparency: '',
  positions_count: '1',
  work_location_type: 'på-plats',
  remote_work_possible: 'nej',
  workplace_name: '',
  workplace_address: '',
  workplace_postal_code: '',
  workplace_city: '',
  work_schedule: '',
  work_start_time: '',
  work_end_time: '',
  contact_email: '',
  application_instructions: '',
  pitch: '',
  benefits: [],
});

export const createEmptyQuestion = (): JobQuestion => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  question_text: '',
  question_type: 'text',
  options: [],
  is_required: true,
  order_index: 0,
  min_value: 0,
  max_value: 100,
});
