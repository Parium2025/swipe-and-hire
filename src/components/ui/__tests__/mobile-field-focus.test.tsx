import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

describe('mobile field focus gestures', () => {
  it.each([
    ['input', <Input aria-label="Namn" />],
    ['textarea', <Textarea aria-label="Innehåll" autoResize={false} />],
  ])('fokuserar %s efter ett stilla tryck', (_name, field) => {
    const { getByRole } = render(field);
    const element = getByRole('textbox');
    const focus = vi.spyOn(element, 'focus');

    fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 30 });
    expect(focus).not.toHaveBeenCalled();
    fireEvent.pointerUp(element, { pointerId: 1, pointerType: 'touch', clientX: 24, clientY: 34 });

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it.each([
    ['input', <Input aria-label="Namn" />],
    ['textarea', <Textarea aria-label="Innehåll" autoResize={false} />],
  ])('fokuserar inte %s när fingret börjar skrolla', (_name, field) => {
    const { getByRole } = render(field);
    const element = getByRole('textbox');
    const focus = vi.spyOn(element, 'focus');

    fireEvent.pointerDown(element, { pointerId: 2, pointerType: 'touch', clientX: 20, clientY: 30 });
    fireEvent.pointerUp(element, { pointerId: 2, pointerType: 'touch', clientX: 20, clientY: 65 });

    expect(focus).not.toHaveBeenCalled();
  });
});