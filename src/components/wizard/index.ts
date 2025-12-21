// Export all wizard components and hooks for easy importing
export { SortableQuestionItem } from './SortableQuestionItem';
export { DropdownField } from './DropdownField';
export { BenefitsDropdown } from './BenefitsDropdown';
export { QuestionFormFields } from './QuestionFormFields';
export { TimeInputField } from './TimeInputField';
export { WizardFooter } from './WizardFooter';
export type { WizardFooterProps } from './WizardFooter';

// Re-export types
export type { JobQuestion, JobFormData, TemplateFormData, JobTemplate, DropdownOption } from '@/types/jobWizard';
export {
  QUESTION_TYPES, 
  SALARY_TYPES, 
  SALARY_TRANSPARENCY_OPTIONS,
  WORK_LOCATION_TYPES,
  REMOTE_WORK_OPTIONS,
  BENEFITS_OPTIONS,
  getQuestionTypeLabel,
  getSalaryTypeLabel,
  getSalaryTransparencyLabel,
  getWorkLocationLabel,
  getRemoteWorkLabel,
  getBenefitLabel,
  createEmptyJobFormData,
  createEmptyTemplateFormData,
  createEmptyQuestion,
} from '@/types/jobWizard';
