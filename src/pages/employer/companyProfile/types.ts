import { Linkedin, Twitter, Instagram, Globe } from 'lucide-react';

export interface SocialMediaLink {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'annat';
  url: string;
}

export const SOCIAL_PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'twitter', label: 'Twitter/X', icon: Twitter },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'annat', label: 'Annat', icon: Globe },
] as const;

export const EMPLOYEE_COUNT_OPTIONS = [
  { value: '1-10 anställda', label: '1-10 anställda' },
  { value: '11-50 anställda', label: '11-50 anställda' },
  { value: '51-200 anställda', label: '51-200 anställda' },
  { value: '201-1000 anställda', label: '201-1000 anställda' },
  { value: '1000+ anställda', label: '1000+ anställda' },
] as const;

export interface CompanyFormData {
  company_name: string;
  org_number: string;
  industry: string;
  address: string;
  website: string;
  company_description: string;
  employee_count: string;
  company_logo_url: string;
  company_logo_original_url: string;
  social_media_links: SocialMediaLink[];
  interview_default_message: string;
  interview_video_default_message: string;
  interview_video_link: string;
  interview_office_address: string;
  interview_office_instructions: string;
}
