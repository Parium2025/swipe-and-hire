/** Full-document reset used when an auth SDK operation can no longer be trusted. */
export const replaceWithCleanAuthPage = (): void => {
  if (typeof window === 'undefined') return;
  window.location.replace('/auth');
};
