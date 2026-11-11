import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8081,
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em chunks próprios: mudam pouco, ficam em cache no
        // navegador entre deploys do app.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-progress",
            "@radix-ui/react-slot",
            "sonner",
          ],
          dates: ["date-fns", "react-day-picker"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
