import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  optimizeDeps: {
    // Avoid prebundling React multiple times which can cause Invalid Hook Call
    exclude: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
}));
