import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

const getPackageName = (id: string) => {
  const normalizedId = id.replace(/\\/g, "/").split("?")[0];
  const nodeModulesPath = normalizedId.split("/node_modules/")[1];

  if (!nodeModulesPath) return null;

  const cleanPath = nodeModulesPath.startsWith(".pnpm/")
    ? nodeModulesPath.split("/").slice(1)
    : nodeModulesPath.split("/");

  const [scopeOrName, maybeName] = cleanPath;
  if (!scopeOrName) return null;

  return scopeOrName.startsWith("@") && maybeName
    ? `${scopeOrName}/${maybeName}`
    : scopeOrName;
};

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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const packageName = getPackageName(id);
          if (!packageName) return;

          if (["react", "react-dom", "scheduler"].includes(packageName)) {
            return 'vendor-react';
          }

          if (packageName.startsWith('@supabase/')) {
            return 'vendor-backend';
          }

          if (packageName.startsWith('@tanstack/')) {
            return 'vendor-query';
          }

          if (
            packageName.startsWith('@radix-ui/') ||
            [
              'class-variance-authority',
              'clsx',
              'cmdk',
              'framer-motion',
              'input-otp',
              'lucide-react',
              'next-themes',
              'sonner',
              'tailwind-merge',
              'vaul',
            ].includes(packageName)
          ) {
            return 'vendor-ui';
          }

          if (["react-router", "react-router-dom"].includes(packageName)) {
            return 'vendor-routing';
          }

          if (packageName.startsWith('@dnd-kit/')) {
            return 'vendor-dnd';
          }

          if (packageName.startsWith('@tiptap/')) {
            return 'vendor-editor';
          }

          if (["pdfjs-dist", "react-pdf"].includes(packageName)) {
            return 'vendor-pdf';
          }

          if (["date-fns", "recharts"].includes(packageName)) {
            return 'vendor-utils';
          }

          if (
            packageName.startsWith('@capacitor/') ||
            packageName.startsWith('@capacitor-community/')
          ) {
            return 'vendor-native';
          }

          return 'vendor-misc';
        },
      },
    },
  },
}));
