import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Auth from '@/pages/Auth';
import EmailConfirm from '@/pages/EmailConfirm';
import EmailRedirect from '@/pages/EmailRedirect';
import AuthTokenBridge from '@/components/AuthTokenBridge';
import {
  initializeAuthBootstrapCredentials,
  resetAuthBootstrapCredentialsForTests,
} from '@/lib/authBootstrapCredentials';

const mocks = vi.hoisted(() => ({
  authState: {
    user: null as null | { id: string },
    profile: null as null | { role?: string; onboarding_completed?: boolean },
    loading: false,
    authAction: null as null | string,
  },
  confirmEmail: vi.fn(),
  updatePassword: vi.fn(),
  getSession: vi.fn(),
  setSession: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  invoke: vi.fn(),
  toast: vi.fn(),
  runAuthLinkSessionTransition: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    confirmEmail: mocks.confirmEmail,
    updatePassword: mocks.updatePassword,
    runAuthLinkSessionTransition: mocks.runAuthLinkSessionTransition,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      setSession: mocks.setSession,
      verifyOtp: mocks.verifyOtp,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock('@/hooks/use-device', () => ({ useDevice: () => 'desktop' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/AnimatedBackground', () => ({ AnimatedBackground: () => null }));
vi.mock('@/components/AuthMobile', () => ({ default: () => null }));
vi.mock('@/components/AuthDesktop', () => ({
  default: (props: {
    isPasswordReset: boolean;
    newPassword: string;
    setNewPassword: (value: string) => void;
    confirmPassword: string;
    setConfirmPassword: (value: string) => void;
    handlePasswordReset: (event: React.FormEvent) => void;
  }) => (
    <form aria-label="auth-password-form" onSubmit={props.handlePasswordReset}>
      <output data-testid="password-reset-state">{String(props.isPasswordReset)}</output>
      <label>
        New password
        <input
          aria-label="new password"
          value={props.newPassword}
          onChange={(event) => props.setNewPassword(event.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          aria-label="confirm password"
          value={props.confirmPassword}
          onChange={(event) => props.setConfirmPassword(event.target.value)}
        />
      </label>
      <button type="submit">Submit password</button>
    </form>
  ),
}));

const renderAt = (path: string, element: React.ReactNode) => {
  resetAuthBootstrapCredentialsForTests();
  window.history.replaceState({}, '', path);
  const html = readFileSync('index.html', 'utf8');
  const gate = html.match(/<script id="parium-auth-url-gate">([\s\S]*?)<\/script>/)?.[1];
  if (!gate) throw new Error('Missing auth URL gate');
  Function(gate)();
  initializeAuthBootstrapCredentials();
  return render(<BrowserRouter>{element}</BrowserRouter>);
};

const submitPassword = (password: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: /new password/i }), {
    target: { value: password },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /confirm password/i }), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit password' }));
};

describe('auth link security flows', () => {
  const originalUserAgent = navigator.userAgent;
  const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  beforeEach(() => {
    window.history.replaceState({}, '', '/auth');
    window.sessionStorage.clear();
    mocks.authState.user = null;
    mocks.authState.profile = null;
    mocks.authState.loading = false;
    mocks.authState.authAction = null;
    mocks.confirmEmail.mockReset().mockResolvedValue({
      success: true,
      processed: true,
      message: 'E-post bekräftad',
      email: 'test@example.com',
    });
    mocks.updatePassword.mockReset().mockResolvedValue({});
    mocks.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    mocks.setSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    mocks.verifyOtp.mockReset().mockResolvedValue({
      data: {
        user: { id: 'account-b' },
        session: { user: { id: 'account-b' }, access_token: 'account-b-session' },
      },
      error: null,
    });
    mocks.exchangeCodeForSession.mockReset().mockResolvedValue({
      data: {
        user: { id: 'account-b' },
        session: { user: { id: 'account-b' }, access_token: 'account-b-session' },
      },
      error: null,
    });
    mocks.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
    mocks.toast.mockReset();
    mocks.runAuthLinkSessionTransition
      .mockReset()
      .mockImplementation((operation: () => Promise<unknown>) => operation());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('labels the expired-recovery resend address and announces a successful resend politely', async () => {
    renderAt('/auth?type=recovery&expired=true', <Auth />);

    const email = await screen.findByRole('textbox', { name: /e-postadress/i });
    expect(email).toHaveAttribute('name', 'email');

    fireEvent.change(email, { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /skicka ny länk/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/ny återställningslänk skickad/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces a failed expired-recovery resend assertively', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('Network error') });
    renderAt('/auth?type=recovery&expired=true', <Auth />);

    const email = await screen.findByRole('textbox', { name: /e-postadress/i });
    fireEvent.change(email, { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /skicka ny länk/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/kunde inte skicka länk/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('never trusts a tokenless confirmed query on the auth page', async () => {
    renderAt('/auth?confirmed=success', <Auth />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('Konto aktiverat!')).not.toBeInTheDocument();
    expect(screen.getByTestId('password-reset-state')).toHaveTextContent('false');
  });

  it.each(['signup', 'magiclink'] as const)(
    'requires an explicit secure action before a shared %s link can create or replace a session',
    async (type) => {
      renderAt(`/auth?type=${type}#token_hash=${type}-secret&type=${type}`, <Auth />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(mocks.verifyOtp).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /fortsätt säkert/i }));
      await waitFor(() => {
        expect(mocks.verifyOtp).toHaveBeenCalledWith({
          token_hash: `${type}-secret`,
          type,
        });
      });
      expect(screen.getByTestId('password-reset-state')).toHaveTextContent('false');
    },
  );

  it('does not redirect an already signed-in user before a captured auth link is reviewed', async () => {
    mocks.authState.user = { id: 'account-a' };
    mocks.authState.profile = {
      role: 'job_seeker',
      onboarding_completed: true,
    };

    renderAt('/auth?type=signup#token_hash=account-b-secret&type=signup', <Auth />);

    expect(await screen.findByRole('button', { name: /fortsätt säkert/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/auth');
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it('resumes normal post-login routing after dismissing a successful custom confirmation', async () => {
    const view = renderAt('/auth?confirm=custom-confirm-secret', <Auth />);
    fireEvent.click(await screen.findByRole('button', { name: 'Logga in' }));

    mocks.authState.user = { id: 'account-a' };
    mocks.authState.profile = { role: 'job_seeker', onboarding_completed: true };
    view.rerender(<BrowserRouter><Auth /></BrowserRouter>);

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
  });

  it('resumes normal post-login routing after leaving an expired recovery link', async () => {
    const view = renderAt('/auth?type=recovery&expired=true', <Auth />);
    fireEvent.click(await screen.findByRole('button', { name: /tillbaka till inloggning/i }));

    mocks.authState.user = { id: 'account-a' };
    mocks.authState.profile = { role: 'job_seeker', onboarding_completed: true };
    view.rerender(<BrowserRouter><Auth /></BrowserRouter>);

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
  });

  it('resumes normal post-login routing after dismissing an invalid auth link', async () => {
    const view = renderAt('/auth?confirm=confirm-secret#token_hash=otp-secret&type=signup', <Auth />);
    fireEvent.click(await screen.findByRole('button', { name: /försök igen/i }));

    mocks.authState.user = { id: 'account-a' };
    mocks.authState.profile = { role: 'job_seeker', onboarding_completed: true };
    view.rerender(<BrowserRouter><Auth /></BrowserRouter>);

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
  });

  it('never silently replaces account A with bearer credentials for account B', async () => {
    mocks.authState.user = { id: 'account-a' };
    renderAt('/auth#access_token=account-b-access&refresh_token=account-b-refresh&type=signup', <Auth />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /fortsätt säkert/i })).toBeInTheDocument();
  });

  it('verifies a URL recovery credential even when another account already has a session', async () => {
    mocks.authState.user = { id: 'account-a' };
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'account-b' }, access_token: 'account-b-session' } },
      error: null,
    });
    renderAt('/auth?type=recovery#token_hash=account-b-recovery&type=recovery', <Auth />);

    submitPassword('new-pass');

    await waitFor(() => {
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'account-b-recovery',
        type: 'recovery',
      });
    });
    expect(mocks.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updatePassword.mock.invocationCallOrder[0],
    );
  });

  it('treats a legacy recovery token field as a token-hash alias', async () => {
    mocks.authState.user = { id: 'account-a' };
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'account-b' }, access_token: 'account-b-session' } },
      error: null,
    });
    renderAt('/auth?type=recovery#token=legacy-recovery&type=recovery', <Auth />);

    submitPassword('new-pass');

    await waitFor(() => {
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'legacy-recovery',
        type: 'recovery',
      });
    });
    expect(mocks.updatePassword).toHaveBeenCalled();
  });

  it('never treats account A existing session as a recovery grant after a reload removed account B credential', async () => {
    mocks.authState.user = { id: 'account-a' };
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'account-a' } } },
      error: null,
    });
    renderAt('/auth?reset=true&type=recovery', <Auth />);

    expect(await screen.findByText(/återställningslänken är redan använd/i)).toBeInTheDocument();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('does not update a password unless recovery verification returns a bound session', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderAt('/auth?type=recovery#token_hash=unbound-recovery&type=recovery', <Auth />);

    submitPassword('new-pass');

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalled());
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('never borrows an existing same-user session when recovery returns only a user', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: 'account-b' }, session: null },
      error: null,
    });
    mocks.getSession.mockResolvedValue({
      data: {
        session: { user: { id: 'account-b' }, access_token: 'unrelated-existing-session' },
      },
      error: null,
    });
    renderAt('/auth?type=recovery#token_hash=user-only-recovery&type=recovery', <Auth />);

    submitPassword('new-pass');

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalled());
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('quarantines a same-document auth credential before the auth route can consume it', async () => {
    resetAuthBootstrapCredentialsForTests();
    window.history.replaceState({}, '', '/home');
    initializeAuthBootstrapCredentials();
    window.history.replaceState(
      {},
      '',
      '/auth#token_hash=runtime-signup-secret&type=signup',
    );

    render(
      <BrowserRouter>
        <AuthTokenBridge>
          <Auth />
        </AuthTokenBridge>
      </BrowserRouter>,
    );

    expect(await screen.findByRole('button', { name: /fortsätt säkert/i })).toBeInTheDocument();
    expect(window.location.href).not.toContain('runtime-signup-secret');
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it('retries a transient session read without consuming the recovery credential twice', async () => {
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: new Error('Failed to fetch') })
      .mockResolvedValue({
        data: { session: { user: { id: 'account-b' }, access_token: 'account-b-session' } },
        error: null,
      });
    renderAt('/auth?type=recovery#token_hash=retry-recovery&type=recovery', <Auth />);

    submitPassword('new-pass');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fel vid lösenordsuppdatering' }),
    ));

    submitPassword('new-pass');
    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith('new-pass'));
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('rejects mixed custom-confirm and OTP credentials before any privileged call', async () => {
    renderAt('/auth?confirm=confirm-secret#token_hash=otp-secret&type=signup', <Auth />);

    expect(await screen.findByText('Ett fel inträffade')).toBeInTheDocument();
    expect(mocks.confirmEmail).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it.each([
    ['seven characters', '1234567'],
    ['more than 128 characters', 'a'.repeat(129)],
  ])('rejects a reset password with %s', async (_label, password) => {
    renderAt('/auth?type=recovery#token_hash=length-check&type=recovery', <Auth />);

    submitPassword(password);

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('removes a query confirmation token before the confirmation request settles', async () => {
    mocks.confirmEmail.mockImplementation(() => new Promise(() => {}));
    renderAt('/email-confirm?confirm=confirmation-secret', <EmailConfirm />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(/bekräftar ditt konto/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.confirmEmail).toHaveBeenCalledWith('confirmation-secret');
    });
    expect(window.location.search).not.toContain('confirmation-secret');
    expect(window.location.hash).not.toContain('confirmation-secret');
  });

  it('removes a legacy auth-page confirmation token before confirming it', async () => {
    mocks.confirmEmail.mockImplementation(() => new Promise(() => {}));
    renderAt('/auth?confirm=auth-confirmation-secret', <Auth />);

    await waitFor(() => {
      expect(mocks.confirmEmail).toHaveBeenCalledWith('auth-confirmation-secret');
    });
    expect(window.location.search).not.toContain('auth-confirmation-secret');
    expect(window.location.hash).not.toContain('auth-confirmation-secret');
  });

  it('captures a fragment confirmation token and removes it before confirming', async () => {
    mocks.confirmEmail.mockImplementation(() => new Promise(() => {}));
    renderAt('/email-confirm#confirm=fragment-secret', <EmailConfirm />);

    await waitFor(() => {
      expect(mocks.confirmEmail).toHaveBeenCalledWith('fragment-secret');
    });
    expect(window.location.hash).not.toContain('fragment-secret');
  });

  it('fails closed for a tokenless success status on the confirmation page', async () => {
    renderAt('/email-confirm?status=success', <EmailConfirm />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Ett fel inträffade');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nu är kontot bekräftat/i)).not.toBeInTheDocument();
    expect(mocks.confirmEmail).not.toHaveBeenCalled();
  });

  it('announces a processed confirmation success once as a polite status', async () => {
    renderAt('/email-confirm?confirm=confirmation-success', <EmailConfirm />);

    const heading = await screen.findByText(/nu är kontot bekräftat/i);
    const status = heading.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces an already-confirmed result once as a polite status', async () => {
    mocks.confirmEmail.mockRejectedValueOnce(new Error('Already confirmed'));
    renderAt('/email-confirm?confirm=already-confirmed', <EmailConfirm />);

    const heading = await screen.findByRole('heading', { name: /redan aktiverat/i });
    const status = heading.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show confirmation success without an explicit processed proof', async () => {
    mocks.confirmEmail.mockResolvedValue({
      success: false,
      processed: false,
      message: 'Kontroll genomförd',
      email: '',
    });
    renderAt('/email-confirm?confirm=invalid-confirmation', <EmailConfirm />);

    expect(await screen.findByText('Ett fel inträffade')).toBeInTheDocument();
    expect(screen.queryByText(/Nu är kontot bekräftat/i)).not.toBeInTheDocument();
  });

  it('can retry a transient confirmation failure from same-page memory without restoring the URL secret', async () => {
    mocks.confirmEmail
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        success: true,
        processed: true,
        message: 'E-post bekräftad',
        email: 'test@example.com',
      });
    renderAt('/email-confirm?confirm=retry-confirmation-secret', <EmailConfirm />);

    expect(await screen.findByRole('button', { name: /försök igen/i })).toBeInTheDocument();
    expect(window.location.href).not.toContain('retry-confirmation-secret');

    fireEvent.click(screen.getByRole('button', { name: /försök igen/i }));

    expect(await screen.findByText(/Nu är kontot bekräftat/i)).toBeInTheDocument();
    expect(mocks.confirmEmail).toHaveBeenCalledTimes(2);
    expect(window.location.href).not.toContain('retry-confirmation-secret');
    expect(window.localStorage.length).toBe(0);
  });

  it('offers the safe existing Safari action when clipboard access is blocked in an in-app WebView', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14; WebView) AppleWebKit/537.36 wv',
    });
    const writeText = vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderAt('/email-redirect?confirm=webview-confirmation', <EmailRedirect />);

    fireEvent.click(await screen.findByRole('button', { name: /kopiera länk/i }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Kunde inte kopiera',
      description: expect.stringMatching(/försök öppna i safari/i),
      variant: 'destructive',
    })));
    expect(mocks.toast.mock.calls.at(-1)?.[0]?.description).not.toMatch(/adressfältet/i);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /försök öppna i safari/i })).toBeInTheDocument();
  });
});
