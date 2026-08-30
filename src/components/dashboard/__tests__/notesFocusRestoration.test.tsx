/**
 * RED → GREEN: fokusåterställning för de expanderade anteckningarna.
 *
 * Live-browser visade att fokus hamnar på BODY efter att dialogen stängts —
 * både via Escape och via stängknappen. Fokus måste tillbaka till exakt den
 * knapp som öppnade dialogen ("Expandera anteckningar"), men bara när Home är
 * aktivt och knappen fortfarande är monterad/synlig.
 *
 * Testet rör inte Notes-UI, texter, editor-tillstånd eller toolbar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

vi.mock('@/hooks/useNotesSync', () => ({
  useNotesSync: () => ({
    content: '<p>Anteckning</p>',
    isSaving: false,
    saveFailed: false,
    lastSaved: null,
    handleChange: vi.fn(),
  }),
}));

vi.mock('@/components/RichNotesEditor', () => ({
  RichNotesEditor: () => <div data-testid="rich-notes-editor" />,
  NotesToolbar: () => <div data-testid="notes-toolbar" />,
}));

import { MemoryRouter } from 'react-router-dom';
import { JobSeekerNotesCard } from '../JobSeekerNotesCard';

const renderCard = (isActive = true) =>
  render(
    <MemoryRouter initialEntries={['/home']}>
      <JobSeekerNotesCard isActive={isActive} />
    </MemoryRouter>,
  );

const openDialog = async () => {
  const expand = screen.getByRole('button', { name: 'Expandera anteckningar' });
  expand.focus();
  fireEvent.click(expand);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Stäng anteckningar' })).toBeInTheDocument();
  });
  return expand;
};

const focusTick = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
};

describe('Expanderade anteckningar — fokusåterställning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it('Escape: fokus återvänder till exakt expandknappen', async () => {
    renderCard();
    const expand = await openDialog();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Stäng anteckningar' })).toBeNull();
    });
    await focusTick();

    expect(document.activeElement).toBe(expand);
  });

  it('stängknappen: fokus återvänder till exakt expandknappen', async () => {
    renderCard();
    const expand = await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Stäng anteckningar' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Stäng anteckningar' })).toBeNull();
    });
    await focusTick();

    expect(document.activeElement).toBe(expand);
  });

  it('Home inaktiveras: dialogen stängs utan att fokusera en dold kontroll', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/home']}>
        <JobSeekerNotesCard isActive />
      </MemoryRouter>,
    );
    const expand = await openDialog();
    (document.activeElement as HTMLElement | null)?.blur();

    view.rerender(
      <MemoryRouter initialEntries={['/home']}>
        <JobSeekerNotesCard isActive={false} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Stäng anteckningar' })).toBeNull();
    });
    await focusTick();

    expect(document.activeElement).not.toBe(expand);
  });
});
