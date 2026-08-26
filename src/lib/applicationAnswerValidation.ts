export interface RequiredApplicationQuestion {
  id: string;
  is_required?: boolean | null;
}

export function isApplicationAnswerPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

export function hasAllRequiredApplicationAnswers(
  questions: RequiredApplicationQuestion[],
  answers: Record<string, unknown>,
): boolean {
  return questions
    .filter((question) => question.is_required)
    .every((question) => isApplicationAnswerPresent(answers[question.id]));
}

export function isPermanentApplicationError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = String(candidate?.code ?? '');
  const message = String(candidate?.message ?? '');

  return (
    code === '23505' ||
    code === '23514' ||
    code === '42501' ||
    message.includes('application_quota_exceeded') ||
    message.includes('required_application_answer_missing')
  );
}