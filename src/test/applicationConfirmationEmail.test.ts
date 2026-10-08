import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createApplicationConfirmationHandler } from '../../supabase/functions/send-application-confirmation/handler';

const request = (email = 'candidate@example.com') => new Request('https://app.example.com/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ applicant_email: email, company_name: 'Stale company', job_title: 'Stale job' }),
});
const caller = { isServiceRole: false, userId: 'candidate', email: 'candidate@example.com' };

describe('single employer-controlled application email path', () => {
  it.each([0, 1, 5])('never creates a fallback when dispatch processes %i events', async (processedCount) => {
    const dispatch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ processedCount })));
    const handler = createApplicationConfirmationHandler({ verifyCaller: vi.fn().mockResolvedValue(caller), dispatch });
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, mode: 'outreach_automation', processedCount });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith();
  });
  it('rejects another recipient before dispatch', async () => {
    const dispatch = vi.fn();
    const handler = createApplicationConfirmationHandler({ verifyCaller: vi.fn().mockResolvedValue(caller), dispatch });
    expect((await handler(request('other@example.com'))).status).toBe(403);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('does not send a separate email when dispatch fails', async () => {
    const dispatch = vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 }));
    const handler = createApplicationConfirmationHandler({ verifyCaller: vi.fn().mockResolvedValue(caller), dispatch });
    expect((await handler(request())).status).toBe(502);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('returns authentication failure without dispatch', async () => {
    const dispatch = vi.fn();
    const handler = createApplicationConfirmationHandler({ verifyCaller: vi.fn().mockResolvedValue(new Response(null, { status: 401 })), dispatch });
    expect((await handler(request())).status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('has no direct sender or alternative template in the compatibility endpoint', () => {
    const source = readFileSync('supabase/functions/send-application-confirmation/index.ts', 'utf8')
      + readFileSync('supabase/functions/send-application-confirmation/handler.ts', 'utf8');
    expect(source).not.toMatch(/sendLoggedTemplateEmail|sendTemplateEmail|templateData|app-confirm-/);
  });
});