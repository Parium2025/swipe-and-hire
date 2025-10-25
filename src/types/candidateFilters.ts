export interface CandidateFilters {
  search: string; // Global sökning
  status: string[]; // ['pending', 'accepted']
  jobIds: string[]; // Filtrera på specifika jobb
  cities: string[]; // Workplace cities
  categories: string[]; // Job categories
  occupations: string[]; // Job occupations
  employmentTypes: string[]; // full_time, part_time
  phone: string; // Sök på telefonnummer
  location: string; // Sök på kandidatens plats
  customAnswers: Record<string, string[]>; // { "question_id": ["answer1", "answer2"] }
}

export const DEFAULT_FILTERS: CandidateFilters = {
  search: '',
  status: [],
  jobIds: [],
  cities: [],
  categories: [],
  occupations: [],
  employmentTypes: [],
  phone: '',
  location: '',
  customAnswers: {},
};

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}
