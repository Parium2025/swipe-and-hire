import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompanyInterviewSettings } from '@/pages/employer/companyProfile/CompanyInterviewSettings';
import type { CompanyFormData } from '@/pages/employer/companyProfile/types';
import { readFileSync } from 'node:fs';

const formData = { interview_video_link: '', interview_video_default_message: '', interview_default_message: '', interview_office_address: '', interview_office_instructions: '' } as CompanyFormData;

describe('Obligatorisk videolänk i välkomstguiden', () => {
  it('visar stjärna, tydlig uppmaning och obligatoriskt fält', () => {
    render(<CompanyInterviewSettings formData={formData} onFormDataChange={() => {}} requireVideoLink />);
    expect(screen.getByLabelText('Videolänk')).toBeRequired();
    expect(screen.getByPlaceholderText('Lägg till videolänk')).toBeInTheDocument();
    expect(screen.getByText('Lägg till videolänk för att gå vidare.')).toBeInTheDocument();
    expect(screen.getByTitle('Obligatoriskt fält')).toBeInTheDocument();
  });
  it('markerar endast giltig, icke-tom länk som ifylld', () => {
    const { rerender } = render(<CompanyInterviewSettings formData={{ ...formData, interview_video_link: 'https://example.com/meeting' }} onFormDataChange={() => {}} requireVideoLink />);
    expect(screen.getByTitle('Obligatoriskt fält')).toBeInTheDocument();
    rerender(<CompanyInterviewSettings formData={{ ...formData, interview_video_link: 'https://meet.google.com/abc-defg-hij' }} onFormDataChange={() => {}} requireVideoLink />);
    expect(screen.getByTitle('Ifyllt')).toBeInTheDocument();
    expect(screen.queryByText('Lägg till videolänk för att gå vidare.')).not.toBeInTheDocument();
  });
  it('behåller vanliga inställningssidan oförändrad', () => {
    render(<CompanyInterviewSettings formData={formData} onFormDataChange={() => {}} />);
    expect(screen.getByLabelText('Videolänk')).not.toBeRequired();
    expect(screen.queryByTitle('Obligatoriskt fält')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Kontor'));
    expect(screen.getByLabelText('Intervjuadress')).toBeInTheDocument();
  });
  it('spärrar nästa och slutförande oberoende av roll och kontorsflik', () => {
    const source = readFileSync('src/components/EmployerWelcomeTunnel.tsx', 'utf8');
    expect(source).toContain("currentStep === 4 && (!formData.interviewVideoLink.trim() || !isValidMeetingLink(formData.interviewVideoLink))");
    const submit = source.slice(source.indexOf('const handleSubmit'), source.indexOf('setIsSubmitting(true)'));
    expect(submit).toContain('setCurrentStep(4)');
    expect(submit.indexOf('!formData.interviewVideoLink.trim()')).toBeLessThan(submit.indexOf('if (isReplay)'));
  });
});