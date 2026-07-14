import 'react';

declare module 'react' {
  // React 18-typerna har inte fetchPriority på iframe, men attributet finns
  // i HTML-specen och hjälper browsern att prioritera laddningen av 3D-scenen.
  interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
    fetchPriority?: 'high' | 'low' | 'auto';
  }
}
