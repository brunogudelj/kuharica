import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base: "./" da build radi i na GitHub Pages (podmapa /kuharica/) i lokalno
export default defineConfig({
  base: "./",
  // Codespaces otvara dev server preko *.app.github.dev adrese
  server: { host: true, allowedHosts: [".app.github.dev"] },
  preview: { host: true, allowedHosts: [".app.github.dev"] },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Wok i Air Fryer Kuharica",
        short_name: "Kuharica",
        description: "Plan obroka, zaliha, kupovina, troškovi i omleti.",
        lang: "hr",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#f3f5f2",
        theme_color: "#1f6b5c",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "fontovi", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
