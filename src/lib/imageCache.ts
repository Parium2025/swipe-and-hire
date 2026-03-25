/**
 * Global bild-cache som håller bilder i minnet hela tiden
 * Överlever component remounts och navigation
 */

interface CachedImage {
  url: string;
  blob: Blob;
  objectUrl: string;
  timestamp: number;
}

class ImageCache {
  private cache = new Map<string, CachedImage>();
  private loading = new Map<string, Promise<CachedImage>>();
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dagar
  
  // Video extensions som inte ska cachas som bilder
  private readonly VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];

  /**
   * Kontrollera om URL:en pekar på en videofil
   */
  private isVideoUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return this.VIDEO_EXTENSIONS.some(ext => lowerUrl.includes(ext));
  }

  /**
   * Skapa stabil cache-nyckel för storage-objekt.
   * Viktigt för signerade URL:er där query/token kan ändras mellan renders.
   */
  private getCacheKey(url: string): string {
    if (!url || url.startsWith('blob:')) return url;

    try {
      const parsed = new URL(
        url,
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
      );
      const isStorageObject = parsed.pathname.includes('/storage/v1/object/');

      // För storage-bilder ignorerar vi query/hash så samma fil får samma cache-nyckel
      if (isStorageObject) {
        return `${parsed.origin}${parsed.pathname}`;
      }

      // För andra URL:er behåll full URL (inkl query) för säkerhet
      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Ladda och cacha en bild permanent
   * Hoppar över videofiler för att undvika onödiga fetch-fel
   */
  async loadImage(url: string): Promise<string> {
    // Hoppa över videofiler - de ska inte cachas som bilder
    if (this.isVideoUrl(url)) {
      return url; // Returnera original-URL för videor
    }

    const cacheKey = this.getCacheKey(url);
    
    // Om bilden redan är cachad, returnera direkt
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Kontrollera om cachen fortfarande är giltig
      if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.objectUrl;
      } else {
        // Cache utgången, rensa
        URL.revokeObjectURL(cached.objectUrl);
        this.cache.delete(cacheKey);
      }
    }

    // Om bilden redan laddas, vänta på den
    const loadingPromise = this.loading.get(cacheKey);
    if (loadingPromise) {
      const result = await loadingPromise;
      return result.objectUrl;
    }

    // Starta ny laddning
    const promise = this.fetchAndCache(url, cacheKey);
    this.loading.set(cacheKey, promise);

    try {
      const result = await promise;
      return result.objectUrl;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  private async fetchAndCache(url: string, cacheKey: string): Promise<CachedImage> {
    try {
      // Fetch utan credentials för cross-origin storage URLs (undviker CORS-fel)
      const isStorageUrl = url.includes('/storage/v1/object/');
      const response = await fetch(url, {
        cache: 'force-cache',
        credentials: isStorageUrl ? 'omit' : 'include',
        mode: isStorageUrl ? 'cors' : 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const cached: CachedImage = {
        url,
        blob,
        objectUrl,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, cached);
      
      return cached;
    } catch (error) {
      // Tyst fel - logga inte varje misslyckad bild
      throw error;
    }
  }

  /**
   * Förladdda flera bilder samtidigt
   * Filtrerar automatiskt bort videofiler
   */
  async preloadImages(urls: string[]): Promise<void> {
    const uniqueUrls = [...new Set(urls.filter(url => 
      url && url.trim() !== '' && !this.isVideoUrl(url)
    ))];
    
    // Ladda alla bilder parallellt
    await Promise.allSettled(
      uniqueUrls.map(url => this.loadImage(url))
    );
  }

  /**
   * Hämta en cachad bild URL (synkron)
   * Returnerar null för videofiler
   */
  getCachedUrl(url: string): string | null {
    // Videor cachas inte
    if (this.isVideoUrl(url)) {
      return null;
    }
    
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.objectUrl;
    }
    return null;
  }

  /**
   * Kontrollera om en bild är cachad
   */
  isCached(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * Rensa hela cachen (använd försiktigt)
   */
  clear(): void {
    for (const cached of this.cache.values()) {
      URL.revokeObjectURL(cached.objectUrl);
    }
    this.cache.clear();
    this.loading.clear();
  }

  /**
   * Rensa utgångna cache-poster
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.CACHE_DURATION) {
        URL.revokeObjectURL(cached.objectUrl);
        this.cache.delete(url);
      }
    }
  }

  /**
   * Hämta cache-statistik
   */
  getStats() {
    return {
      cachedImages: this.cache.size,
      loadingImages: this.loading.size
    };
  }
}

// Global singleton instance
export const imageCache = new ImageCache();

// Rensa utgångna bilder varje timme
if (typeof window !== 'undefined') {
  setInterval(() => {
    imageCache.clearExpired();
  }, 60 * 60 * 1000);
}
