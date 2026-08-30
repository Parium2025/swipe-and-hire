/**
 * Home hålls monterad av KeepAlive även när en annan route visas. Det här är
 * den enda källan till "är jobbsökarens Home faktiskt synlig just nu?".
 *
 * VIKTIGT: /index tillhör Search (KeepAlive-monterad söksida) och räknas
 * ALDRIG som Home-aktiv.
 */
export const isHomeActivePath = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return normalized === '/home';
};
