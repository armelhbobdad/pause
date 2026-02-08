import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@pause/db/schema": resolve(__dirname, "../../packages/db/src/schema"),
      "@pause/db": resolve(__dirname, "../../packages/db/src/index.ts"),
      "@pause/auth": resolve(__dirname, "../../packages/auth/src/index.ts"),
      "@pause/env/server": resolve(
        __dirname,
        "../../packages/env/src/server.ts"
      ),
      "@pause/env/web": resolve(__dirname, "../../packages/env/src/web.ts"),
      "@pause/env": resolve(__dirname, "../../packages/env/src/index.ts"),
      "@pause/ace": resolve(__dirname, "../../packages/ace/src/index.ts"),
      "drizzle-orm": resolve(__dirname, "./node_modules/drizzle-orm"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        inline: [
          "@pause/db",
          "@pause/auth",
          "@pause/env",
          "@pause/ace",
          "drizzle-orm",
        ],
      },
    },
  },
});
