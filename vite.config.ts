import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      // Prevent stale module/deps caching in preview/dev that can cause black screen
      "Cache-Control": "no-store",
    },
    // Lovable preview kör appen bakom en HTTPS-proxy.
    // Utan dessa inställningar kan Vite-klienten försöka ansluta HMR till
    // `localhost:8080` (som inte är nåbart från webbläsaren) och då får man
    // `[vite] failed to connect to websocket`.
    hmr: {
      protocol: "wss",
      clientPort: 443,
      // Tom sträng gör att Vite-klienten faller tillbaka till importMetaUrl.hostname
      // (dvs. samma host som preview-sidan) istället för att hårdkoda "localhost".
      host: "",
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Fix recharts lodash CJS→ESM incompatibility in Vite dev
      "lodash/get": path.resolve(__dirname, "node_modules/lodash-es/get.js"),
      "lodash/isEqual": path.resolve(__dirname, "node_modules/lodash-es/isEqual.js"),
      "lodash/throttle": path.resolve(__dirname, "node_modules/lodash-es/throttle.js"),
      "lodash/isNil": path.resolve(__dirname, "node_modules/lodash-es/isNil.js"),
      "lodash/isFunction": path.resolve(__dirname, "node_modules/lodash-es/isFunction.js"),
      "lodash/isString": path.resolve(__dirname, "node_modules/lodash-es/isString.js"),
      "lodash/isNumber": path.resolve(__dirname, "node_modules/lodash-es/isNumber.js"),
      "lodash/isObject": path.resolve(__dirname, "node_modules/lodash-es/isObject.js"),
      "lodash/upperFirst": path.resolve(__dirname, "node_modules/lodash-es/upperFirst.js"),
      "lodash/sortBy": path.resolve(__dirname, "node_modules/lodash-es/sortBy.js"),
      "lodash/range": path.resolve(__dirname, "node_modules/lodash-es/range.js"),
      "lodash/max": path.resolve(__dirname, "node_modules/lodash-es/max.js"),
      "lodash/min": path.resolve(__dirname, "node_modules/lodash-es/min.js"),
      "lodash/uniqBy": path.resolve(__dirname, "node_modules/lodash-es/uniqBy.js"),
      "lodash/every": path.resolve(__dirname, "node_modules/lodash-es/every.js"),
      "lodash/some": path.resolve(__dirname, "node_modules/lodash-es/some.js"),
      "lodash/flatMap": path.resolve(__dirname, "node_modules/lodash-es/flatMap.js"),
      "lodash/mapValues": path.resolve(__dirname, "node_modules/lodash-es/mapValues.js"),
      "lodash/last": path.resolve(__dirname, "node_modules/lodash-es/last.js"),
      "lodash/isArray": path.resolve(__dirname, "node_modules/lodash-es/isArray.js"),
      "lodash/isNaN": path.resolve(__dirname, "node_modules/lodash-es/isNaN.js"),
      "lodash/isPlainObject": path.resolve(__dirname, "node_modules/lodash-es/isPlainObject.js"),
      "lodash/isEmpty": path.resolve(__dirname, "node_modules/lodash-es/isEmpty.js"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  optimizeDeps: {
    // Rebuild pre-bundled deps from scratch to avoid stale/missing chunk refs
    force: true,
    // Preview stability: avoid auto-optimizing a large dep graph that can create
    // stale/missing chunk references in proxied preview sessions.
    noDiscovery: true,
    include: [
      'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      'lodash', 'lodash/get', 'lodash/isEqual', 'lodash/throttle', 'lodash/isNil',
      'lodash/isFunction', 'lodash/isString', 'lodash/isNumber', 'lodash/isObject',
      'lodash/upperFirst', 'lodash/sortBy', 'lodash/range', 'lodash/max', 'lodash/min',
      'lodash/uniqBy', 'lodash/every', 'lodash/some', 'lodash/flatMap', 'lodash/mapValues',
      'recharts',
    ],
  },
}));
