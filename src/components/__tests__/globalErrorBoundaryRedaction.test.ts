import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  safeErrorTelemetry,
  shouldFlagPotentialAuthStall,
} from '@/components/GlobalErrorBoundary';

describe('GlobalErrorBoundary production redaction', () => {
  it('keeps secrets out of the production telemetry payload', () => {
    const payload = safeErrorTelemetry(
      new Error('access_token=super-secret&email=person@example.com'),
      'error-reference',
    );

    expect(payload).toEqual({
      errorId: 'error-reference',
      errorName: 'Error',
    });
    expect(JSON.stringify(payload)).not.toContain('super-secret');
    expect(JSON.stringify(payload)).not.toContain('person@example.com');
  });

  it('gates raw error details and the technical-details UI to development builds', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/GlobalErrorBoundary.tsx'),
      'utf8',
    );

    expect(source).toContain('if (import.meta.env.DEV)');
    expect(source).toContain('const showTechnicalDetails = import.meta.env.DEV');
    expect(source).toContain('showTechnicalDetails && errorDetails');
  });

  it('never interrupts routes that own their token parameter', () => {
    const token = 'a'.repeat(64);

    expect(
      shouldFlagPotentialAuthStall(`https://www.parium.se/team-invite?token=${token}`),
    ).toBe(false);
    expect(
      shouldFlagPotentialAuthStall(`https://www.parium.se/unsubscribe?token=${token}`),
    ).toBe(false);
    expect(
      shouldFlagPotentialAuthStall(`https://www.parium.se/email-confirm?token=${token}`),
    ).toBe(false);
  });

  it('still detects an auth-bearing URL that should already have been normalized', () => {
    expect(
      shouldFlagPotentialAuthStall(
        'https://www.parium.se/home?access_token=access&refresh_token=refresh&type=recovery',
      ),
    ).toBe(true);
  });
});
