import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamInvite from '../TeamInvite';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  refreshProfile: vi.fn(),
  auth: { user: null as { id: string } | null, loading: false },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.auth.user,
    loading: mocks.auth.loading,
    refreshProfile: mocks.refreshProfile,
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

describe('TeamInvite', () => {
  beforeEach(() => {
    mocks.auth.user = null;
    mocks.auth.loading = false;
    mocks.invoke.mockReset();
    mocks.refreshProfile.mockReset();
    sessionStorage.clear();
  });

  afterEach(cleanup);

  it('bevarar länken och skickar en utloggad mottagare till inloggningen', async () => {
    const token = 'a'.repeat(64);
    renderInvite(`/team-invite?token=${token}`);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth'));
    expect(sessionStorage.getItem('parium-auth-return-to')).toBe(`/team-invite?token=${token}`);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('visar serverns kontomeddelande och exakt en startsidesknapp', async () => {
    mocks.auth.user = { id: 'admin-user' };
    mocks.invoke.mockResolvedValue({
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
    mocks.auth.user = { id: 'job-seeker-user' };
    mocks.invoke.mockResolvedValue({
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
    mocks.auth.user = { id: 'invited-employer' };
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    mocks.refreshProfile.mockResolvedValue(undefined);

    renderInvite(`/team-invite?token=${'c'.repeat(64)}`);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/home'));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.refreshProfile).toHaveBeenCalledTimes(1);
  });
});