import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApplicationQuestionsWizard } from '../ApplicationQuestionsWizard';

vi.mock('@/components/TruncatedText', () => ({ TruncatedText: ({ text }: { text: string }) => <span>{text}</span> }));
vi.mock('@/components/ui/truncated-text', () => ({ TruncatedText: ({ text }: { text: string }) => <span>{text}</span> }));

describe('mobile submitted review layout', () => {
  it('uses equal 16px upper and panel-bottom spacing with a full-strength confirmed state', () => {
    render(<ApplicationQuestionsWizard
      questions={[{ id: 'q1', question_text: 'Har du erfarenhet?', question_type: 'yes_no', is_required: true, order_index: 0 }]}
      answers={{ q1: 'yes' }} onAnswerChange={vi.fn()} onSubmit={vi.fn()}
      isSubmitting={false} canSubmit hasAlreadyApplied
    />);
    const confirmed = screen.getByRole('button', { name: 'Redan sökt' });
    expect(confirmed).toBeDisabled();
    expect(confirmed).toHaveClass('disabled:opacity-100');
    expect(confirmed.parentElement).toHaveClass('pt-4');
    expect(confirmed).toHaveClass('shadow-[var(--shadow-application-confirmed)]');
  });
  it('retains the same footer nodes after confirmation and prevents a second submission', () => {
    const onSubmit = vi.fn();
    const props = {
      questions: [{ id: 'q1', question_text: 'Har du erfarenhet?', question_type: 'yes_no' as const, is_required: true, order_index: 0 }],
      answers: { q1: 'yes' },
      onAnswerChange: vi.fn(), onSubmit, isSubmitting: false, canSubmit: true,
      hasAlreadyApplied: false, preserveSubmissionLayout: true,
      profileSelector: <div>Min profil</div>,
    };
    const { rerender } = render(<ApplicationQuestionsWizard {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Granska' }));
    const submit = screen.getByRole('button', { name: 'Skicka ansökan' });
    const back = screen.getByRole('button', { name: 'Tillbaka' });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(<ApplicationQuestionsWizard {...props} hasAlreadyApplied justApplied />);
    expect(screen.getByRole('button', { name: 'Skicka ansökan' })).toBe(submit);
    expect(submit).toBeDisabled();
    expect(back).toBeDisabled();
    expect(back).not.toHaveClass('invisible');
    expect(submit).not.toHaveClass('hidden');
    expect(screen.getByText('Min profil')).toBeVisible();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});