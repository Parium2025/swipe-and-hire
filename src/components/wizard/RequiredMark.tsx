import { forwardRef } from 'react';

/**
 * Obligatorisk-markering (*) som är röd tills fältet är ifyllt och vit när
 * det är klart. Ger användaren en levande checklista direkt i formuläret.
 */
export const RequiredMark = forwardRef<HTMLSpanElement, { filled: boolean }>(({ filled }, ref) => {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      title={filled ? 'Ifyllt' : 'Obligatoriskt fält'}
      className={`ml-0.5 transition-colors duration-300 ${
        filled ? 'text-white' : 'text-red-400'
      }`}
    >
      *
    </span>
  );
});

RequiredMark.displayName = 'RequiredMark';

export default RequiredMark;
