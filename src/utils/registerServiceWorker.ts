// Service Worker registration with auto-update
export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registrerad');

          // Check for updates every 30 seconds when app is open
          setInterval(() => {
            registration.update();
          }, 30000);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available - auto reload
                console.log('🔄 Ny version hittad - uppdaterar automatiskt...');
                
                // Send message to activate new service worker
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                
                // Reload page after a short delay
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
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
