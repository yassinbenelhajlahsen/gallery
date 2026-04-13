import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-v2.png"],
      manifest: {
        name: env.VITE_PWA_APP_NAME || "Rasso",
        short_name: env.VITE_PWA_APP_NAME || "Rasso",
        description: env.VITE_SITE_DESCRIPTION || "Private photo and video gallery",
        theme_color: "#FAFAF7",
        background_color: "#FAFAF7",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/favicon-v2.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/favicon-app-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*thumb.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "thumbnail-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@firebase/firestore") || id.includes("firebase/firestore")) {
            return "firebase-firestore";
          }
          if (id.includes("@firebase/auth") || id.includes("firebase/auth")) {
            return "firebase-auth";
          }
          if (id.includes("@firebase/storage") || id.includes("firebase/storage")) {
            return "firebase-storage";
          }
          if (id.includes("react-router")) {
            return "router-vendor";
          }
          if (id.includes("react-dom") || id.includes("/react/")) {
            return "react-vendor";
          }
        },
      },
    },
  },
  };
});
