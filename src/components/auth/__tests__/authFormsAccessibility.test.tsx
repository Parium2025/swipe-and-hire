// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthDesktop from '@/components/AuthDesktop';
import AuthMobile from '@/components/AuthMobile';

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

const authMocks = {
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  resetPassword: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authMocks,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const variants = [
  ['mobile', AuthMobile],
  ['desktop', AuthDesktop],
] as const;

const activeVariants = [
  ['mobile', AuthMobile],
  ['desktop', AuthDesktop],
] as const;

const renderAuth = (
  Component: (typeof variants)[number][1],
  initialMode: 'login' | 'register',
  initialRole?: 'job_seeker' | 'employer',
) =>
  render(
    <MemoryRouter>
      <Component
        isPasswordReset={false}
        newPassword=""
        setNewPassword={vi.fn()}
        confirmPassword=""
        setConfirmPassword={vi.fn()}
        handlePasswordReset={vi.fn()}
        initialMode={initialMode}
        initialRole={initialRole}
      />
    </MemoryRouter>,
  );

const getFormSection = (container: HTMLElement, inputSelector: string) => {
  const input = container.querySelector<HTMLInputElement>(inputSelector);
  expect(input).not.toBeNull();
  const form = input!.closest('form');
  expect(form).not.toBeNull();
  const section = form!.parentElement;
  expect(section).not.toBeNull();
  return section!;
};

describe.each(variants)('%s auth accessibility', (name, Component) => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it.each([
    ['login', false, true],
    ['register', true, false],
  ] as const)(
    'removes the inactive form from focus and assistive technology in %s mode',
    (initialMode, loginHidden, registerHidden) => {
      const { container } = renderAuth(Component, initialMode);
      const loginSection = getFormSection(container, '#login-email');
      const registerSection = getFormSection(container, '#firstName');

      expect(loginSection.hidden).toBe(loginHidden);
      expect(loginSection).toHaveAttribute('aria-hidden', String(loginHidden));
      if (loginHidden) expect(loginSection).toHaveAttribute('inert', '');
      else expect(loginSection).not.toHaveAttribute('inert');
      expect(loginSection).toHaveAttribute('role', 'tabpanel');
      expect(loginSection).toHaveAttribute('id', `auth-${name}-login-panel`);
      expect(loginSection).toHaveAttribute('aria-labelledby', `auth-${name}-login-tab`);
      expect(registerSection.hidden).toBe(registerHidden);
      expect(registerSection).toHaveAttribute('aria-hidden', String(registerHidden));
      if (registerHidden) expect(registerSection).toHaveAttribute('inert', '');
      else expect(registerSection).not.toHaveAttribute('inert');
      expect(registerSection).toHaveAttribute('role', 'tabpanel');
      expect(registerSection).toHaveAttribute('id', `auth-${name}-signup-panel`);
      expect(registerSection).toHaveAttribute('aria-labelledby', `auth-${name}-signup-tab`);
    },
  );

  it('gives the password visibility control a dynamic name, state and focus treatment', () => {
    const { container } = renderAuth(Component, 'login');
    const password = container.querySelector<HTMLInputElement>('#login-password');
    expect(password).not.toBeNull();
    const toggle = password!.parentElement!.querySelector<HTMLButtonElement>('button');
    expect(toggle).not.toBeNull();

    expect(toggle).toHaveAccessibleName('Visa lösenord');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveClass('focus-visible:ring-2');
    expect(toggle!.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(toggle!);

    expect(toggle).toHaveAccessibleName('Dölj lösenord');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe.each(activeVariants)('%s active registration validation', (_name, Component) => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('connects an invalid phone message to the field', () => {
    const { container } = renderAuth(Component, 'register');
    const phone = container.querySelector<HTMLInputElement>('#phone');
    expect(phone).not.toBeNull();

    fireEvent.change(phone!, { target: { value: '123' } });

    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveAttribute('aria-describedby', 'phone-error');
    expect(container.querySelector('#phone-error')).toHaveAttribute('role', 'alert');
  });

  it('exposes the shared password minimum to the browser', () => {
    const { container } = renderAuth(Component, 'register');
    expect(container.querySelector('#password')).toHaveAttribute('minlength', '8');
  });

  it('connects an invalid company website message to the field', () => {
    const { container } = renderAuth(Component, 'register', 'employer');
    const website = container.querySelector<HTMLInputElement>('#website');
    expect(website).not.toBeNull();

    fireEvent.change(website!, { target: { value: 'javascript:alert(1)' } });
    fireEvent.blur(website!);

    expect(website).toHaveAttribute('aria-invalid', 'true');
    expect(website).toHaveAttribute('aria-describedby', 'website-error');
    expect(container.querySelector('#website-error')).toHaveAttribute('role', 'alert');
  });
});
