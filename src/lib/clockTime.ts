// Valid clock time in HH:MM (00:00–23:59)
export const isValidClockTime = (value: string | null | undefined): boolean =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test((value || '').trim());
