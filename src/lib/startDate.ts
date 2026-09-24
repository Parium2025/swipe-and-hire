/**
 * Ett startdatum som redan passerat (t.ex. efter återpublicering) räknas
 * som "Omgående". Returnerar null för tomma eller passerade datum.
 */
export function effectiveStartDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today ? null : value;
}
