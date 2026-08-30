import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExpandedNotesDialog } from '@/components/dashboard/ExpandedNotesDialog';

vi.mock('@/components/RichNotesEditor', () => ({
  RichNotesEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="rich-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
  NotesToolbar: () => <div data-testid="notes-toolbar" />,
}));

describe('ExpandedNotesDialog accessibility', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    cleanup();
  });

  it('provides an accessible description and no Radix missing-description warning', () => {
    render(
      <ExpandedNotesDialog
        open
        onOpenChange={() => {}}
        content=""
        onChange={() => {}}
        placeholder="Skriv dina anteckningar..."
        isSaving={false}
        saveFailed={false}
        lastSaved={null}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const describedById = dialog.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();

    const description = document.getElementById(describedById!);
    expect(description).toHaveTextContent(/privata anteckningar/);

    const relevantWarnings = warnSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('Missing Description')
    );
    expect(relevantWarnings).toHaveLength(0);
  });
});
