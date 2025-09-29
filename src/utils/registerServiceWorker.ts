// Service Worker registration with manual update support
let updateAvailableCallback: ((registration: ServiceWorkerRegistration) => void) | null = null;

export const onUpdateAvailable = (callback: (registration: ServiceWorkerRegistration) => void) => {
  updateAvailableCallback = callback;
};

export const checkForUpdates = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      console.log('🔍 Kollar efter uppdateringar...');
      await registration.update();
      return true;
    }
  }
  return false;
};

export const applyUpdate = () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
};

export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registrerad');

          // Check for updates every 30 seconds
          setInterval(() => {
            registration.update();
          }, 30000);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 Ny version tillgänglig!');
                
                // Notify callback if registered
                if (updateAvailableCallback) {
                  updateAvailableCallback(registration);
                }
              }
            });
          });
        })
        .catch((error) => {
          console.log('❌ Service Worker registrering misslyckades:', error);
        });

      // Reload page when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
};
