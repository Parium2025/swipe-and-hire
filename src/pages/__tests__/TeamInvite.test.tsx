import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamInvite from '../TeamInvite';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
  auth: { user: null as { id: string; email?: string } | null, loading: false },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.auth.user,
    loading: mocks.auth.loading,
    refreshProfile: mocks.refreshProfile,
    signOut: mocks.signOut,
  }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderInvite = (entry: string) => render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/team-invite" element={<TeamInvite />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  </HelmetProvider>,
);

const PREVIEW = { data: { email: 'ny@firma.se', organizationName: 'Firma AB', accountExists: true }, error: null };

describe('TeamInvite', () => {
  beforeEach(() => {
    mocks.auth.user = null;
    mocks.auth.loading = false;
    mocks.invoke.mockReset();
    mocks.refreshProfile.mockReset();
    mocks.signOut.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    // Förhandsvisningen hämtas med fetch (utan inloggningsberoende).
    // Skicka den vidare till samma mock så testerna styr båda vägarna.
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const { data, error } = await mocks.invoke('team-invite-accept', { body });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        return ctx ?? new Response(JSON.stringify({ error: 'fel' }), { status: 500 });
      }
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('förklarar inbjudan för en utloggad mottagare och bevarar länken vid inloggning', async () => {
    const token = 'a'.repeat(64);
    mocks.invoke.mockResolvedValue({ data: { email: 'ny@firma.se', organizationName: 'Firma AB', accountExists: true }, error: null });
    renderInvite(`/team-invite?token=${token}`);

    expect(await screen.findByText('Logga in med ny@firma.se för att gå med i teamet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Logga in' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth'));
    expect(sessionStorage.getItem('parium-auth-return-to')).toBe(`/team-invite?token=${token}`);
    expect(localStorage.getItem('parium-pending-team-invite')).toContain(token);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it('skickar en mottagare utan konto till registrering som arbetsgivare', async () => {
    mocks.invoke.mockResolvedValue({ data: { email: 'ny@firma.se', organizationName: 'Firma AB', accountExists: false }, error: null });
    renderInvite(`/team-invite?token=${'f'.repeat(64)}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Skapa konto' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth?mode=register&role=employer'));
  });

  it('erbjuder en enda knapp för att byta konto när fel konto är inloggat', async () => {
    mocks.auth.user = { id: 'inviter', email: 'chef@firma.se' };
    mocks.signOut.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue({ data: { email: 'ny@firma.se', organizationName: 'Firma AB', accountExists: true }, error: null });
    renderInvite(`/team-invite?token=${'9'.repeat(64)}`);

    const button = await screen.findByRole('button', { name: 'Logga ut och fortsätt' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth'));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it('visar serverns kontomeddelande och exakt en startsidesknapp', async () => {
    mocks.auth.user = { id: 'admin-user', email: 'ny@firma.se' };
    mocks.invoke.mockResolvedValueOnce(PREVIEW).mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'Inbjudan gäller en annan e-postadress. Logga in med den adressen.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    renderInvite(`/team-invite?token=${'b'.repeat(64)}`);

    expect(await screen.findByText('Inbjudan gäller en annan e-postadress. Logga in med den adressen.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Till startsidan' })).toHaveLength(1);
    expect(screen.queryAllByRole('link', { name: 'Till startsidan' })).toHaveLength(0);
  });

  it('stoppar ett jobbsökarkonto med serverns tydliga meddelande', async () => {
    mocks.auth.user = { id: 'job-seeker-user', email: 'ny@firma.se' };
    mocks.invoke.mockResolvedValueOnce(PREVIEW).mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'Den här adressen har redan ett jobbsökarkonto. Be om en inbjudan till din företagsmejl.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    renderInvite(`/team-invite?token=${'d'.repeat(64)}`);

    expect(await screen.findByText('Den här adressen har redan ett jobbsökarkonto. Be om en inbjudan till din företagsmejl.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Till startsidan' })).toHaveLength(1);
  });

  it('visar att en redan använd inbjudan inte kan användas igen', async () => {
    mocks.auth.user = { id: 'invited-employer' };
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'Inbjudan har redan använts.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    renderInvite(`/team-invite?token=${'e'.repeat(64)}`);

    expect(await screen.findByText('Inbjudan har redan använts.')).toBeInTheDocument();
    expect(mocks.refreshProfile).not.toHaveBeenCalled();
  });

  it('visar ett tydligt fel och en enda knapp när token saknas', async () => {
    mocks.auth.user = { id: 'employer-user' };
    renderInvite('/team-invite');

    expect(await screen.findByText('Länken saknar en giltig inbjudningskod.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Till startsidan' })).toHaveLength(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('läser om profilen och går till välkomstflödet efter godkänd inbjudan', async () => {
    mocks.auth.user = { id: 'invited-employer', email: 'ny@firma.se' };
    mocks.invoke.mockResolvedValueOnce(PREVIEW).mockResolvedValue({ data: { success: true }, error: null });
    mocks.refreshProfile.mockResolvedValue(undefined);

    renderInvite(`/team-invite?token=${'c'.repeat(64)}`);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/home'));
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.refreshProfile).toHaveBeenCalledTimes(1);
  });
});