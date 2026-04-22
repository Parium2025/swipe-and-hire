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
  // Map preserverar insättningsordning → används för LRU
  private cache = new Map<string, CachedImage>();
  private loading = new Map<string, Promise<CachedImage>>();
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dagar
  // LRU-tak: håll minnesförbrukning under kontroll på low-end devices.
  // Höjt från 200 → 500 för att skydda logos (5–20 KB styck) från att evictas
  // mellan jobbilder (200–800 KB styck) i swipe-läget.
  private readonly MAX_ENTRIES = 500;
  // Logos och små bilder skyddas från LRU-eviction så länge de är under denna gräns
  private readonly SMALL_ASSET_THRESHOLD_BYTES = 50 * 1024; // 50 KB
  
  // Filändelser som aldrig ska blob-cachas (stora/binära dokument)
  private readonly SKIP_EXTENSIONS = ['.avi', '.mkv'];

  /**
   * Markera en post som "nyligen använd" (flytta till slutet av Map)
   */
  private touch(cacheKey: string, cached: CachedImage): void {
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, cached);
  }

  /**
   * Evictar äldsta posten/poster tills vi är under MAX_ENTRIES.
   * Hoppar över små assets (logos, ikoner) så de aldrig flickar mellan navigeringar.
   */
  private enforceLimit(): void {
    if (this.cache.size <= this.MAX_ENTRIES) return;

    // Iterera från äldsta → nyaste och evicta endast STORA assets först
    for (const [key, cached] of this.cache.entries()) {
      if (this.cache.size <= this.MAX_ENTRIES) break;
      if (cached.blob.size >= this.SMALL_ASSET_THRESHOLD_BYTES) {
        URL.revokeObjectURL(cached.objectUrl);
        this.cache.delete(key);
      }
    }

    // Om vi fortfarande är över taket (extremfall: bara små assets) → evicta äldsta oavsett storlek
    while (this.cache.size > this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.cache.get(oldestKey);
      if (oldest) URL.revokeObjectURL(oldest.objectUrl);
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Kontrollera om URL:en pekar på en fil som inte ska cachas
   */
  private shouldSkip(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return this.SKIP_EXTENSIONS.some(ext => lowerUrl.includes(ext));
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
      const version = parsed.searchParams.get('v') || parsed.searchParams.get('version') || parsed.searchParams.get('t');

      // För storage-bilder ignorerar vi query/hash så samma fil får samma cache-nyckel
      if (isStorageObject) {
        return version
          ? `${parsed.origin}${parsed.pathname}?v=${version}`
          : `${parsed.origin}${parsed.pathname}`;
      }

      // För andra URL:er behåll full URL (inkl query) för säkerhet
      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Ladda och cacha media permanent (bilder + videor)
   * Hoppar över filer som inte ska cachas
   */
  async loadImage(url: string): Promise<string> {
    if (this.shouldSkip(url)) {
      return url;
    }

    const cacheKey = this.getCacheKey(url);
    
    // Om bilden redan är cachad, returnera direkt
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Kontrollera om cachen fortfarande är giltig
      if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
        this.touch(cacheKey, cached); // LRU: markera som nyligen använd
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
      this.enforceLimit(); // LRU-evict om vi överskrider taket
      
      return cached;
    } catch (error) {
      // Tyst fel - logga inte varje misslyckad bild
      throw error;
    }
  }

  /**
   * Förladdda flera media samtidigt
   */
  async preloadImages(urls: string[]): Promise<void> {
    const uniqueUrls = [...new Set(urls.filter(url => 
      url && url.trim() !== '' && !this.shouldSkip(url)
    ))];
    
    // Ladda alla bilder parallellt
    await Promise.allSettled(
      uniqueUrls.map(url => this.loadImage(url))
    );
  }

  /**
   * Hämta en cachad URL (synkron)
   */
  getCachedUrl(url: string): string | null {
    if (this.shouldSkip(url)) {
      return null;
    }

    const cacheKey = this.getCacheKey(url);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      this.touch(cacheKey, cached); // LRU: markera som nyligen använd
      return cached.objectUrl;
    }
    return null;
  }

  /**
   * Kontrollera om en bild är cachad
   */
  isCached(url: string): boolean {
    return this.cache.has(this.getCacheKey(url));
  }

  /**
   * Evict a single URL from the cache (e.g. when blob URL is revoked by OS)
   */
  evict(url: string): void {
    const cacheKey = this.getCacheKey(url);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      URL.revokeObjectURL(cached.objectUrl);
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Evict alla cache-poster vars URL innehåller ett substring (t.ex. user_id-mapp)
   */
  evictByPattern(pattern: string): number {
    let count = 0;
    for (const [key, cached] of this.cache.entries()) {
      if (key.includes(pattern)) {
        URL.revokeObjectURL(cached.objectUrl);
        this.cache.delete(key);
        count++;
      }
    }
    return count;
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
