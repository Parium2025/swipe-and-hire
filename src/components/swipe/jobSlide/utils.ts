// Rena helpers utan side-effects — enkla att unit-testa och delas mellan
// JobSlide-container och dess subkomponenter.

export function getImageObjectPosition(value?: string): string {
  if (!value || value === 'center') return 'center 50%';
  if (value === 'top') return 'center 20%';
  if (value === 'bottom') return 'center 80%';
  return `center ${value}%`;
}

export function isWithinTapHintTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-tap-hint-scroll]'))
  );
}

export function isWithinInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, a, input, textarea, select, [role="button"], [data-swipe-action-button]',
      ),
    )
  );
}

export function getCompanyInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
