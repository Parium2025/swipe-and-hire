import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InterviewResponse from '../InterviewResponse';

const token = '00000000-0000-4000-8000-000000000001';

describe('InterviewResponse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, jobTitle: 'Mekaniker' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('kan ändra nej till ja och skickar inte ett nytt svar utan en knapptryckning', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[`/intervjusvar?interview_token=${token}&answer=no`]}>
          <Routes><Route path="/intervjusvar" element={<InterviewResponse />} /></Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByRole('button', { name: 'Nej, jag kan inte' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nej, jag kan inte' }));
    await screen.findByRole('button', { name: 'Ändra svar till ja' });
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body))).toEqual({ token, answer: 'no' });

    fireEvent.click(screen.getByRole('button', { name: 'Ändra svar till ja' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body))).toEqual({ token, answer: 'yes' });
    expect(await screen.findByRole('button', { name: 'Ändra svar till nej' })).toBeInTheDocument();
  });
});