import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Generates /version.json at build time with a unique build signature.
 * Used by index.html's first-paint check to detect stale Safari cache.
 */
const versionJsonPlugin = (): Plugin => {
  let buildVersion = '';
  return {
    name: 'parium-version-json',
    apply: 'build',
    buildStart() {
      buildVersion = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: buildVersion, builtAt: new Date().toISOString() }),
      });
    },
    transformIndexHtml(html) {
      return html.replace(
        '<!--PARIUM_BUILD_VERSION-->',
        `<meta name="parium-build" content="${buildVersion}" />`
      );
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cache-Control": "no-store",
    },
    hmr: {
      protocol: "wss",
      clientPort: 443,
      host: "",
    },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  optimizeDeps: {
    force: true,
    include: [
      'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      'react-dom/client',
      'recharts',
      'lodash',
      'attr-accept',
      'react-dropzone',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-label',
      '@radix-ui/react-separator',
      '@radix-ui/react-tabs',
      '@radix-ui/react-switch',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-accordion',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-progress',
      '@radix-ui/react-slider',
      '@radix-ui/react-navigation-menu',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'cmdk',
      'sonner',
      'date-fns',
      'input-otp',
      'vaul',
      'embla-carousel-react',
      'react-day-picker',
      'react-resizable-panels',
      'use-sync-external-store',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/index.js',
      'use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim/with-selector.js',
      'hoist-non-react-statics',
    ],
  },
}));
