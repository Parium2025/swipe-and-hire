/**
 * RED → GREEN: Notes-verktygsfältet ska vara tangentbordsåtkomligt och
 * korrekt exponerat för skärmläsare, utan att ändra utseende eller det
 * befintliga touch-beteendet (första tap = förhandsvisning, andra = kör).
 *
 * - Knapparna får inte vara tabIndex={-1} och får inte blur:a sig själva.
 * - Varje knapp behöver ett tillgängligt namn (aria-label = title).
 * - aria-pressed endast på de fem växlarna, aldrig på Ångra/Gör om.
 * - Tangentbord/programmatiska klick (event.detail === 0) kör kommandot
 *   direkt exakt en gång, även på touch-enheter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';


const touchCapable = { value: false };
vi.mock('@/hooks/useInputCapability', () => ({
  useTouchCapable: () => touchCapable.value,
}));

vi.mock('@/components/ui/tooltip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/tooltip')>();
  return {
    ...actual,
    // Radix' Portal/Popper-positionering är en separat integration och kan
    // inte mäta layout i jsdom. Behåll den riktiga Root/Provider/Trigger-
    // logiken här, men ersätt bara det positionsberoende innehållet.
    TooltipContent: ({ children }: { children: React.ReactNode }) => (
      <div role="tooltip">{children}</div>
    ),
  };
});

import { NotesToolbar } from '@/components/RichNotesEditor';

type ChainCall = string;

const commands: ChainCall[] = [];

function createFakeEditor(active: Record<string, boolean> = {}) {
  const chain = () => {
    const c: Record<string, () => unknown> = {};
    const record = (name: string) => () => {
      commands.push(name);
      return c;
    };
    c.focus = record('focus');
    c.toggleBold = record('toggleBold');
    c.toggleItalic = record('toggleItalic');
    c.toggleStrike = record('toggleStrike');
    c.toggleBulletList = record('toggleBulletList');
    c.toggleTaskList = record('toggleTaskList');
    c.undo = record('undo');
    c.redo = record('redo');
    c.run = () => true;
    return c;
  };

  return {
    isFocused: true,
    isActive: (name: string) => !!active[name],
    can: () => ({ undo: () => true, redo: () => true }),
    chain,
    on: () => {},
    off: () => {},
  } as unknown as import('@tiptap/react').Editor;
}

const TOGGLES = ['Fet', 'Kursiv', 'Genomstruken', 'Punktlista', 'Checkbox'];

describe('Notes-verktygsfältets tillgänglighet', () => {
  beforeEach(() => {
    commands.length = 0;
    touchCapable.value = false;
  });

  afterEach(() => cleanup());

  it('compact: 5 knappar, alla tabb-bara och namngivna', () => {
    render(<NotesToolbar editor={createFakeEditor()} compact />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);

    for (const button of buttons) {
      expect(button.tabIndex).toBe(0);
      expect(button.getAttribute('tabindex')).not.toBe('-1');
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
    for (const label of TOGGLES) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('large: 7 knappar (inkl. Ångra/Gör om), alla tabb-bara och namngivna', () => {
    render(<NotesToolbar editor={createFakeEditor()} large />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);

    for (const button of buttons) {
      expect(button.tabIndex).toBe(0);
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Ångra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gör om' })).toBeInTheDocument();
  });

  it('exakt fem växlar har aria-pressed; Ångra/Gör om saknar det', () => {
    render(
      <NotesToolbar
        editor={createFakeEditor({ bold: true, taskList: true })}
        large
      />,
    );

    const pressedStates = TOGGLES.map((label) =>
      screen.getByRole('button', { name: label }).getAttribute('aria-pressed'),
    );
    expect(pressedStates).toEqual(['true', 'false', 'false', 'false', 'true']);

    expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')))
      .toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Ångra' })).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('button', { name: 'Gör om' })).not.toHaveAttribute('aria-pressed');
  });

  it('behåller inte fokus-stöld: ingen tabIndex=-1 och fokus behålls på knappen', () => {
    render(<NotesToolbar editor={createFakeEditor()} large />);
    const bold = screen.getByRole('button', { name: 'Fet' });
    act(() => bold.focus());
    expect(document.activeElement).toBe(bold);
  });

  it('touch: detail=1 ger första tap förhandsvisning och andra tap kör kommandot', () => {
    touchCapable.value = true;
    render(<NotesToolbar editor={createFakeEditor()} large />);
    const bold = screen.getByRole('button', { name: 'Fet' });

    fireEvent.click(bold, { detail: 1 });
    expect(commands.filter((c) => c === 'toggleBold')).toHaveLength(0);

    fireEvent.click(bold, { detail: 1 });
    expect(commands.filter((c) => c === 'toggleBold')).toHaveLength(1);
  });

  it('tangentbord/programmatiskt: detail=0 kör kommandot direkt exakt en gång', () => {
    touchCapable.value = true;
    render(<NotesToolbar editor={createFakeEditor()} large />);
    const italic = screen.getByRole('button', { name: 'Kursiv' });

    fireEvent.click(italic, { detail: 0 });
    expect(commands.filter((c) => c === 'toggleItalic')).toHaveLength(1);

    fireEvent.click(italic, { detail: 0 });
    expect(commands.filter((c) => c === 'toggleItalic')).toHaveLength(2);
  });

  it('mus (icke-touch): detail=1 kör kommandot direkt', () => {
    touchCapable.value = false;
    render(<NotesToolbar editor={createFakeEditor()} large />);
    fireEvent.click(screen.getByRole('button', { name: 'Punktlista' }), { detail: 1 });
    expect(commands.filter((c) => c === 'toggleBulletList')).toHaveLength(1);
  });

  it('toolbar-roten är stabilt markerad med data-notes-toolbar utan layoutändring', () => {
    const { container } = render(<NotesToolbar editor={createFakeEditor()} large />);
    const root = container.querySelector('[data-notes-toolbar]');

    expect(root).not.toBeNull();
    // Markören ska sitta på själva toolbar-roten som innehåller knapparna …
    expect(root).toContainElement(screen.getByRole('button', { name: 'Fet' }));
    // … och layoutklasserna (inkl. overflow-hidden som klipper yttre ringar)
    // ska vara oförändrade.
    for (const cls of ['flex', 'items-center', 'overflow-hidden']) {
      expect(root!.className).toContain(cls);
    }
  });

  it('Home-scopad :focus-visible-regel för toolbar-knappar är HELT INSET (kan inte klippas av overflow-hidden)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    // Regeln måste vara scopad till Home-markören OCH toolbar-markören.
    const selectorRe =
      /body\[data-jobseeker-home-active="true"\]\s+\[data-notes-toolbar\]\s+button[^{]*:focus-visible[^{]*\{/;
    const match = css.match(selectorRe);
    expect(match).not.toBeNull();

    const block = css.slice(match!.index, css.indexOf('}', match!.index!));
    // Dubbelring helt innanför knappen: vit 2px + mörk kontrastkant.
    expect(block).toContain('outline: 2px solid #FFFFFF');
    expect(block).toMatch(/outline-offset:\s*-/);
    const shadows = block.match(/inset 0 0 0 \d+px (?:#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\))/g) ?? [];
    expect(shadows.length).toBeGreaterThanOrEqual(2);
    expect(shadows.some((s) => s.includes('#FFFFFF'))).toBe(true);
    expect(shadows.some((s) => s.includes('15, 23, 42'))).toBe(true);

    // Den globala yttre ringen för övriga Home-element ska finnas kvar.
    expect(css).toContain('box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.85)');
  });
});
