/**
 * Obligatorisk-markering (*) som är röd tills fältet är ifyllt och vit när
 * det är klart. Ger användaren en levande checklista direkt i formuläret.
 */
export function RequiredMark({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      title={filled ? 'Ifyllt' : 'Obligatoriskt fält'}
      className={`ml-0.5 transition-colors duration-300 ${
        filled ? 'text-white' : 'text-red-400'
      }`}
    >
      *
    </span>
  );
}

export default RequiredMark;
