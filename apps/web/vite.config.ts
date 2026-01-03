import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-192x192.svg", "pwa-512x512.svg"],
      manifest: {
        name: "Ponto RH",
        short_name: "Ponto RH",
        description: "Controle de ponto profissional para Recursos Humanos",
        theme_color: "#1f4e8c",
        background_color: "#f5f6f8",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          },
          {
            src: "/pwa-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          }
        ]
      }
    })
  ]
});
