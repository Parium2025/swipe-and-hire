// Svenska röda dagar — beräknas dynamiskt (påsk via Meeus/Jones/Butcher-algoritmen),
// så skottår och rörliga helgdagar alltid stämmer utan hårdkodade listor.

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function key(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const cache = new Map<number, Set<string>>();

function holidaysForYear(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const midsummerEve = (() => {
    // Midsommarafton = fredagen mellan 19–25 juni
    const d = new Date(year, 5, 19);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    return d;
  })();
  const allSaintsDay = (() => {
    // Alla helgons dag = lördagen mellan 31 okt–6 nov
    const d = new Date(year, 9, 31);
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    return d;
  })();

  const days = [
    new Date(year, 0, 1),   // Nyårsdagen
    new Date(year, 0, 6),   // Trettondedag jul
    addDays(easter, -2),    // Långfredagen
    easter,                 // Påskdagen
    addDays(easter, 1),     // Annandag påsk
    new Date(year, 4, 1),   // Första maj
    addDays(easter, 39),    // Kristi himmelsfärdsdag
    addDays(easter, 49),    // Pingstdagen
    new Date(year, 5, 6),   // Nationaldagen
    midsummerEve,           // Midsommarafton
    addDays(midsummerEve, 1), // Midsommardagen
    allSaintsDay,           // Alla helgons dag
    new Date(year, 11, 24), // Julafton
    new Date(year, 11, 25), // Juldagen
    new Date(year, 11, 26), // Annandag jul
    new Date(year, 11, 31), // Nyårsafton
  ];

  const set = new Set(days.map(key));
  cache.set(year, set);
  return set;
}

/** Returnerar true om datumet är en svensk röd dag (helgdag eller afton). */
export function isSwedishHoliday(date: Date): boolean {
  return holidaysForYear(date.getFullYear()).has(key(date));
}
