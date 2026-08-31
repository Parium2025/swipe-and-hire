import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/hooks/useNotesSync', () => ({
  useNotesSync: () => ({
    content: '<img src="x" onerror="globalThis.pwned=1"><script>globalThis.pwned=1</script><a href="javascript:alert(1)">länk</a>',
    isSaving: false,
    saveFailed: false,
    lastSaved: null,
    saveConflict: null,
    handleChange: vi.fn(),
    acceptServerVersion: vi.fn(),
    overwriteWithLocalVersion: vi.fn(),
  }),
}));

vi.mock('@/components/RichNotesEditor', () => ({
  RichNotesEditor: () => <div data-testid="notes-editor-loading" />,
  NotesToolbar: () => <div />,
}));

vi.mock('../ExpandedNotesDialog', () => ({
  ExpandedNotesDialog: () => null,
}));

import { JobSeekerNotesCard } from '../JobSeekerNotesCard';

describe('JobSeekerNotesCard fallback HTML', () => {
  it('sanitizes cached/server rich text before the editor is ready', () => {
    const { container } = render(<JobSeekerNotesCard />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(container.textContent).toContain('länk');
  });
});
