import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";

// Vissa installationer får två fysiska React-kopior i node_modules, vilket gör
// att hooks kraschar i testmiljön. Vi låser alla imports till samma kopia.
const require = createRequire(import.meta.url);
const reactDir = path.dirname(require.resolve("react/package.json"));
const reactDomDir = path.dirname(require.resolve("react-dom/package.json"));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: path.resolve(__dirname, "./src") + "/" },
      { find: /^react$/, replacement: reactDir },
      { find: /^react-dom$/, replacement: reactDomDir },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
});
