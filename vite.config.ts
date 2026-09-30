import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Injects the <link rel="dns-prefetch"> for the project's own Supabase host at
 * build time.
 *
 * It used to be hardcoded in index.html, which tied the public repository to one
 * particular project ref. Reading it from VITE_SUPABASE_URL keeps index.html
 * environment-agnostic, so a fork only has to fill in .env.
 */
function supabasePrefetch(env: Record<string, string>): Plugin {
  const url = env.VITE_SUPABASE_URL?.trim();
  return {
    name: "dydlye:supabase-prefetch",
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) return html;
        return html.replace(
          '<link rel="dns-prefetch" href="https://router.project-osrm.org" />',
          `<link rel="dns-prefetch" href="${url}" />\n    <link rel="dns-prefetch" href="https://router.project-osrm.org" />`,
        );
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");

  return {
    base: "./",
    plugins: [
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      react(),
      tailwindcss(),
      supabasePrefetch(env),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      target: "es2015",
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react/") ||
              id.includes("node_modules/scheduler")
            ) {
              return "react-vendor";
            }
            if (
              id.includes("@tanstack/react-router") ||
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/query-core")
            ) {
              return "tanstack-vendor";
            }
            if (id.includes("node_modules/leaflet")) {
              return "leaflet-vendor";
            }
            if (
              id.includes("@supabase/supabase-js") ||
              id.includes("@supabase/auth-js") ||
              id.includes("@supabase/postgrest-js") ||
              id.includes("@supabase/storage-js") ||
              id.includes("@supabase/realtime-js") ||
              id.includes("@supabase/functions-js")
            ) {
              return "supabase-vendor";
            }
          },
        },
      },
    },
  };
});
