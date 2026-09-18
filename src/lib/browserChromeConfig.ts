export const BROWSER_CHROME_COLORS = {
  landing: '#2a2a2a',
  app: '#00193D',
  audience: '#001F3D',
  auth: '#062B5E',
} as const;

export const isLandingVideoPath = (pathname: string) => pathname === '/' || pathname === '';

export const isAudienceLandingPath = (pathname: string) =>
  pathname === '/arbetsgivare' || pathname === '/jobbsokare';

export const isAuthPath = (pathname: string) => pathname === '/auth';

export const getBrowserChromeColor = (pathname: string) => {
  if (isLandingVideoPath(pathname)) return BROWSER_CHROME_COLORS.landing;
  if (isAudienceLandingPath(pathname)) return BROWSER_CHROME_COLORS.audience;
  if (isAuthPath(pathname)) return BROWSER_CHROME_COLORS.auth;
  return BROWSER_CHROME_COLORS.app;
};